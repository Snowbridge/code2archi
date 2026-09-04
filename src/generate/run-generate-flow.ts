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
import { DiscoveryModelReader } from "../discovery-model/discovery-model-reader.js";
import {
  createFlowProgress,
  createFlowParallelContext,
  defineFlowSteps,
  processorGroupFlowStep,
} from "../platform/cli-progress/index.js";
import { getLogger, isDebugEnabled } from "../platform/logging/index.js";
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

export function runGenerateFlow(input: RunGenerateFlowInput): void {
  const logger = getLogger("generate.flow");
  logger.info("flow start", {
    outputFile: input.outputFile,
    discoveryModelDir: input.discoveryModelDir,
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

  const { shutdown: shutdownPool } = createFlowParallelContext(
    input.parallelism,
    progress,
    [],
    input.profile,
  );

  let activeStep = "1";

  const discovery = new DiscoveryModelReader().read(input.discoveryModelDir);
  const archiStore = new ArchiModelStore({
    modelName: input.modelName,
    modelId: input.modelId,
  });

  try {
    logger.info("step start", { step: 1, action: "elements generation", groupId: GENERATE_ELEMENTS_GROUP_ID });
    activeStep = "1";
    measureFlowStep("1", () => {
      runGenerateProcessorGroup(
        GENERATE_ELEMENTS_GROUP_ID,
        discovery,
        archiStore,
        input.processorFilters,
        { decorate: !input.noDecorate },
        progress.step("1"),
      );
    });
    logger.info("step completed", { step: 1 });

    logger.info("step start", { step: 2, action: "views generation", groupId: GENERATE_VIEWS_GROUP_ID });
    activeStep = "2";
    measureFlowStep("2", () => {
      runGenerateProcessorGroup(
        GENERATE_VIEWS_GROUP_ID,
        discovery,
        archiStore,
        input.processorFilters,
        { decorate: !input.noDecorate },
        progress.step("2"),
      );
    });
    logger.info("step completed", { step: 2 });

    logger.info("step start", { step: 3, action: "writing archimate-model", outputFile: input.outputFile });
    activeStep = "3";
    measureFlowStep("3", () => {
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
  } catch (error) {
    progress.fail(activeStep);
    throw error;
  } finally {
    shutdownPool();
    progress.stop();
  }
}
