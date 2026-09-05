import {
  SCAN_TRANSFORM_GROUP_ID,
  SCAN_SCOPE_GROUP_ID,
  SCAN_EXTRACT_GROUP_ID,
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
import {
  createFlowProgress,
  createFlowParallelContext,
  defineFlowSteps,
  scopeDiscoveryFlowStep,
  processorGroupFlowStep,
} from "../platform/cli-progress/index.js";
import { getLogger } from "../platform/logging/index.js";
import { measureFlowStep } from "../platform/profiling/flow-metrics.js";
import type { ParallelismOptions } from "../platform/parallelism/parallelism-options.js";
import { initScanIoCache, type ScanIoCacheOptions } from "../platform/scan-io/index.js";
import type { ScanArgs } from "./validate-scan-args.js";
import type { ScanCommandCacheArgv } from "../cli/scan-cache-options.js";
import { cacheArgvToScanIoOptions } from "../cli/scan-cache-options.js";

export interface RunScanFlowInput extends ScanArgs {
  readonly processorFilters: ProcessorFilters;
  readonly verbose: boolean;
  readonly profile: boolean;
  readonly parallelism: ParallelismOptions;
  readonly scanIoCache: ScanIoCacheOptions;
}

export function createRunScanFlowInput(
  scanArgs: ScanArgs,
  argv: GlobalArgv,
  cacheArgv: ScanCommandCacheArgv,
): RunScanFlowInput {
  return {
    ...scanArgs,
    processorFilters: resolveProcessorFilters(argv),
    verbose: argv.verbose,
    profile: argv.profile,
    parallelism: {
      threads: argv.threads,
      sync: argv.sync,
      continueOnError: argv.continueOnError,
    },
    scanIoCache: cacheArgvToScanIoOptions(cacheArgv),
  };
}

export async function runScanFlow(input: RunScanFlowInput): Promise<void> {
  const logger = getLogger("scan.flow");
  initScanIoCache(input.scanIoCache);
  logger.info("flow start", {
    sourceDirCount: input.sourceDirs.length,
    outputDir: input.outputDir,
    scanId: input.scanId,
    threads: input.parallelism.threads,
    sync: input.parallelism.sync,
    continueOnError: input.parallelism.continueOnError,
  });

  const scopeProcessorCount = processorRegistry.listForBuiltInStep(
    SCAN_SCOPE_GROUP_ID,
    input.processorFilters,
  ).length;
  const sourceProcessorCount = processorRegistry.listForBuiltInStep(
    SCAN_EXTRACT_GROUP_ID,
    input.processorFilters,
  ).length;
  const linkProcessorCount = processorRegistry.listForBuiltInStep(
    SCAN_TRANSFORM_GROUP_ID,
    input.processorFilters,
  ).length;

  const progress = createFlowProgress({
    verbose: input.verbose,
    steps: defineFlowSteps(
      scopeDiscoveryFlowStep(input.sourceDirs.length, scopeProcessorCount),
      { id: "1b", label: "Repository namespaces", initialTotal: 1 },
      processorGroupFlowStep("2", "Extract", sourceProcessorCount, 0),
      processorGroupFlowStep("3", "Transform", linkProcessorCount),
      { id: "4", label: "Writing discovery-model", initialTotal: 1 },
    ),
  });

  const { context: parallelContext, shutdown: shutdownPool } = createFlowParallelContext(
    input.parallelism,
    progress,
    ["1", "2", "3"],
    input.profile,
    input.scanIoCache,
  );

  let activeStep = "1";

  const store = new RunEntityStore({
    sourceDirs: input.sourceDirs,
    scanId: input.scanId,
    runStartedAt: input.runStartedAt,
  });

  try {
    logger.info("step start", { step: 1, action: "repository discovery", groupId: SCAN_SCOPE_GROUP_ID });
    activeStep = "1";
    await measureFlowStep("1", async () => {
      await runScanScopeGroup(
        input.sourceDirs,
        input.processorFilters,
        store,
        progress.step("1"),
        parallelContext,
      );
    });
    const repositoryCount = store.getEntities("Repository").length;
    logger.info("step completed", { step: 1, count: repositoryCount });

    progress.step("2").setTotal(sourceProcessorCount * repositoryCount);

    logger.info("step start", { step: "1b", action: "repository common root" });
    activeStep = "1b";
    await measureFlowStep("1b", async () => {
      const repositoryCommonRoot = store.finalizeRepositoryNamespaces();
      logger.info("repository common root computed", { repositoryCommonRoot });
      progress.step("1b").tick(1);
    });

    logger.info("step start", { step: 2, action: "source discovery", groupId: SCAN_EXTRACT_GROUP_ID });
    activeStep = "2";
    await measureFlowStep("2", async () => {
      await runCreateIntentProcessorGroup(
        SCAN_EXTRACT_GROUP_ID,
        input.processorFilters,
        store,
        progress.step("2"),
        parallelContext,
        "2",
      );
    });
    logger.info("step completed", { step: 2 });

    logger.info("step start", { step: 3, action: "link discovery", groupId: SCAN_TRANSFORM_GROUP_ID });
    activeStep = "3";
    await measureFlowStep("3", async () => {
      await runCreateIntentProcessorGroup(
        SCAN_TRANSFORM_GROUP_ID,
        input.processorFilters,
        store,
        progress.step("3"),
        parallelContext,
        "3",
      );
    });
    logger.info("step completed", { step: 3 });

    logger.info("step start", { step: 4, action: "writing discovery-model", outputDir: input.outputDir });
    activeStep = "4";
    await measureFlowStep("4", async () => {
      new DiscoveryModelWriter().write({
        outputDir: input.outputDir,
        store,
        scannedAt: new Date(),
      });
      progress.step("4").tick(1);
    });
    logger.info("step completed", { step: 4, outputDir: input.outputDir });

    logger.info("flow completed", { outputDir: input.outputDir, repositoryCount });
  } catch (error) {
    progress.fail(activeStep);
    throw error;
  } finally {
    shutdownPool();
    progress.stop();
  }
}
