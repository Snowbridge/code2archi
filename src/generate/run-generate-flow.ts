import { CliError } from "../cli/cli-error.js";
import { ExitCode } from "../cli/exit-codes.js";
import {
  GENERATE_ELEMENTS_GROUP_ID,
  GENERATE_VIEWS_GROUP_ID,
  type GlobalArgv,
} from "../cli/processor-groups.js";
import {
  type ProcessorFilters,
  processorRegistry,
  resolveProcessorFilters,
} from "../platform/processors/processor-registry.js";
import { runGenerateProcessorGroup } from "../platform/processors/run-generate-processor-group.js";
import { ArchiModelStore } from "../archimate-model/archi-model-store.js";
import { ArchiModelWriter } from "../archimate-model/archi-model-writer.js";
import { ArchiModelDomWriter } from "../archimate-model/archi-model-dom-writer.js";
import { CodeInventoryReader } from "../code-inventory/code-inventory-reader.js";
import {
  createFlowProgress,
  createFlowParallelContext,
  defineFlowSteps,
  processorGroupFlowStep,
} from "../platform/cli-progress/index.js";
import { getLogger, isDebugEnabled, logError } from "../platform/logging/index.js";
import { measureFlowStep } from "../platform/profiling/flow-metrics.js";
import type { ParallelismOptions } from "../platform/parallelism/parallelism-options.js";
import type { GenerateArgs } from "./validate-generate-args.js";

export interface RunGenerateFlowInput extends GenerateArgs {
  readonly processorFilters: ProcessorFilters;
  readonly verbose: boolean;
  readonly profile: boolean;
  readonly parallelism: ParallelismOptions;
}

export function createRunGenerateFlowInput(
  generateArgs: GenerateArgs,
  argv: GlobalArgv,
): RunGenerateFlowInput {
  return {
    ...generateArgs,
    processorFilters: resolveProcessorFilters(argv),
    verbose: argv.verbose,
    profile: argv.profile,
    parallelism: {
      threads: argv.threads,
      sync: argv.sync,
      continueOnError: argv.continueOnError,
    },
  };
}

export async function runGenerateFlow(input: RunGenerateFlowInput): Promise<void> {
  const logger = getLogger("generate.flow");
  logger.info("flow start", {
    outputFile: input.outputFile,
    codeInventoryDir: input.codeInventoryDir,
    threads: input.parallelism.threads,
    sync: input.parallelism.sync,
    continueOnError: input.parallelism.continueOnError,
  });

  const elementsProcessorCount = processorRegistry.listForBuiltInStep(
    GENERATE_ELEMENTS_GROUP_ID,
    input.processorFilters,
  ).length;
  const viewsProcessorCount = processorRegistry.listForBuiltInStep(
    GENERATE_VIEWS_GROUP_ID,
    input.processorFilters,
  ).length;

  const progress = createFlowProgress({
    verbose: input.verbose,
    steps: defineFlowSteps(
      processorGroupFlowStep("1", "Elements generation", elementsProcessorCount),
      processorGroupFlowStep("2", "Views generation", viewsProcessorCount),
      { id: "3", label: "Writing archimate-model", initialTotal: 1 },
    ),
  });

  const { context: parallelContext, shutdown: shutdownPool } = createFlowParallelContext(
    input.parallelism,
    progress,
    ["1", "2"],
    input.profile,
  );

  const deferredErrors: Error[] = [];

  const discovery = new CodeInventoryReader().read(input.codeInventoryDir);
  const archiStore = new ArchiModelStore({
    modelName: input.modelName,
    modelId: input.modelId,
  });

  const runStep = async (stepId: string, action: () => Promise<void>): Promise<void> => {
    try {
      await measureFlowStep(stepId, action);
    } catch (error) {
      if (input.parallelism.continueOnError) {
        logError(logger, error, { step: stepId });
        progress.fail(stepId);
        deferredErrors.push(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      progress.fail(stepId);
      throw error;
    }
  };

  try {
    logger.info("step start", { step: 1, action: "elements generation", groupId: GENERATE_ELEMENTS_GROUP_ID });
    await runStep("1", async () => {
      await runGenerateProcessorGroup(
        GENERATE_ELEMENTS_GROUP_ID,
        discovery,
        archiStore,
        input.processorFilters,
        { decorate: !input.noDecorate },
        progress.step("1"),
        parallelContext,
      );
    });
    logger.info("step completed", { step: 1 });

    logger.info("step start", { step: 2, action: "views generation", groupId: GENERATE_VIEWS_GROUP_ID });
    await runStep("2", async () => {
      await runGenerateProcessorGroup(
        GENERATE_VIEWS_GROUP_ID,
        discovery,
        archiStore,
        input.processorFilters,
        { decorate: !input.noDecorate },
        progress.step("2"),
        parallelContext,
      );
    });
    logger.info("step completed", { step: 2 });

    logger.info("step start", { step: 3, action: "writing archimate-model", outputFile: input.outputFile });
    await runStep("3", async () => {
      new ArchiModelWriter().write({
        outputFile: input.outputFile,
        store: archiStore,
      });
      if (isDebugEnabled()) {
        new ArchiModelDomWriter().write({
          outputFile: input.outputFile,
          store: archiStore,
        });
      }
      progress.step("3").tick(1);
    });
    logger.info("step completed", { step: 3, outputFile: input.outputFile });

    logger.info("flow completed", { outputFile: input.outputFile });
  } finally {
    shutdownPool();
    progress.stop();
  }

  if (deferredErrors.length > 0) {
    const summary = deferredErrors.map((error) => error.message).join("; ");
    throw new CliError(
      `Generate completed with ${deferredErrors.length} error(s): ${summary}`,
      ExitCode.RUNTIME,
    );
  }
}
