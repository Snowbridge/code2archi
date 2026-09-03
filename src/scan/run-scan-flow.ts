import {
  SCAN_SCOPE_GROUP_ID,
  SCAN_SOURCE_GROUP_ID,
  type GlobalArgv,
} from "../cli/processor-groups.js";
import {
  type ProcessorFilters,
  processorRegistry,
  resolveProcessorFilters,
} from "../platform/processors/processor-registry.js";
import { runCreateIntentProcessorGroup } from "../platform/processors/run-create-intent-processor-group.js";
import { runScanScopeGroup } from "../platform/processors/run-scan-scope-group.js";
import { DiscoveryModelWriter } from "../discovery-model/discovery-model-writer.js";
import { RunEntityStore } from "../discovery-model/run-entity-store.js";
import { createFlowProgress } from "../platform/cli-progress/index.js";
import { getLogger } from "../platform/logging/index.js";
import { measureFlowStep } from "../platform/profiling/flow-metrics.js";
import type { ScanArgs } from "./validate-scan-args.js";

export interface RunScanFlowInput extends ScanArgs {
  readonly processorFilters: ProcessorFilters;
  readonly verbose: boolean;
}

export function createRunScanFlowInput(
  scanArgs: ScanArgs,
  argv: GlobalArgv,
): RunScanFlowInput {
  return {
    ...scanArgs,
    processorFilters: resolveProcessorFilters(argv),
    verbose: argv.verbose,
  };
}

export function runScanFlow(input: RunScanFlowInput): void {
  const logger = getLogger("scan.flow");
  logger.info("flow start", {
    sourceDirCount: input.sourceDirs.length,
    outputDir: input.outputDir,
    scanId: input.scanId,
  });

  const scopeProcessorCount = processorRegistry.listForBuiltInStep(
    SCAN_SCOPE_GROUP_ID,
    input.processorFilters,
  ).length;
  const sourceProcessorCount = processorRegistry.listForBuiltInStep(
    SCAN_SOURCE_GROUP_ID,
    input.processorFilters,
  ).length;

  const progress = createFlowProgress({
    verbose: input.verbose,
    steps: [
      { id: "1", label: "Repository discovery", initialTotal: scopeProcessorCount },
      { id: "1b", label: "Repository namespaces", initialTotal: 1 },
      { id: "2", label: "Source discovery", initialTotal: 0 },
      { id: "3", label: "Writing discovery-model", initialTotal: 1 },
    ],
  });

  let activeStep = "1";

  const store = new RunEntityStore({
    sourceDirs: input.sourceDirs,
    scanId: input.scanId,
    runStartedAt: input.runStartedAt,
  });

  try {
    logger.info("step start", { step: 1, action: "repository discovery", groupId: SCAN_SCOPE_GROUP_ID });
    activeStep = "1";
    measureFlowStep("1", () => {
      runScanScopeGroup(input.sourceDirs, input.processorFilters, store, progress.step("1"));
    });
    const repositoryCount = store.getEntities("Repository").length;
    logger.info("step completed", { step: 1, count: repositoryCount });

    progress.step("2").setTotal(sourceProcessorCount * repositoryCount);

    logger.info("step start", { step: "1b", action: "repository common root" });
    activeStep = "1b";
    measureFlowStep("1b", () => {
      const repositoryCommonRoot = store.finalizeRepositoryNamespaces();
      logger.info("repository common root computed", { repositoryCommonRoot });
      progress.step("1b").tick(1);
    });

    logger.info("step start", { step: 2, action: "source discovery", groupId: SCAN_SOURCE_GROUP_ID });
    activeStep = "2";
    measureFlowStep("2", () => {
      runCreateIntentProcessorGroup(
        SCAN_SOURCE_GROUP_ID,
        input.processorFilters,
        store,
        progress.step("2"),
      );
    });
    logger.info("step completed", { step: 2 });

    logger.info("step start", { step: 3, action: "writing discovery-model", outputDir: input.outputDir });
    activeStep = "3";
    measureFlowStep("3", () => {
      new DiscoveryModelWriter().write({
        outputDir: input.outputDir,
        store,
        scannedAt: new Date(),
      });
      progress.step("3").tick(1);
    });
    logger.info("step completed", { step: 3, outputDir: input.outputDir });

    logger.info("flow completed", { outputDir: input.outputDir, repositoryCount });
  } catch (error) {
    progress.fail(activeStep);
    throw error;
  } finally {
    progress.stop();
  }
}
