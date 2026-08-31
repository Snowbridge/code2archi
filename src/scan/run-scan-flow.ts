import {
  SCAN_SCOPE_GROUP_ID,
  SCAN_SOURCE_GROUP_ID,
  type GlobalArgv,
} from "../cli/processor-groups.js";
import {
  type ProcessorFilters,
  resolveProcessorFilters,
} from "../platform/processors/processor-registry.js";
import { runCreateIntentProcessorGroup } from "../platform/processors/run-create-intent-processor-group.js";
import { runScanScopeGroup } from "../platform/processors/run-scan-scope-group.js";
import { DiscoveryModelWriter } from "../discovery-model/discovery-model-writer.js";
import { RunEntityStore } from "../discovery-model/run-entity-store.js";
import { getLogger } from "../platform/logging/index.js";
import type { ScanArgs } from "./validate-scan-args.js";

export interface RunScanFlowInput extends ScanArgs {
  readonly processorFilters: ProcessorFilters;
}

export function createRunScanFlowInput(
  scanArgs: ScanArgs,
  argv: GlobalArgv,
): RunScanFlowInput {
  return {
    ...scanArgs,
    processorFilters: resolveProcessorFilters(argv),
  };
}

export function runScanFlow(input: RunScanFlowInput): void {
  const logger = getLogger("scan.flow");
  logger.info("flow start", {
    sourceDirCount: input.sourceDirs.length,
    outputDir: input.outputDir,
    scanId: input.scanId,
  });

  const store = new RunEntityStore({
    sourceDirs: input.sourceDirs,
    scanId: input.scanId,
    runStartedAt: input.runStartedAt,
  });

  logger.info("step start", { step: 1, action: "repository discovery", groupId: SCAN_SCOPE_GROUP_ID });
  runScanScopeGroup(input.sourceDirs, input.processorFilters, store);
  const repositoryCount = store.getEntities("Repository").length;
  logger.info("step completed", { step: 1, count: repositoryCount });

  const repositoryCommonRoot = store.finalizeRepositoryNamespaces();
  logger.info("repository common root computed", { repositoryCommonRoot });

  logger.info("step start", { step: 2, action: "source discovery", groupId: SCAN_SOURCE_GROUP_ID });
  runCreateIntentProcessorGroup(SCAN_SOURCE_GROUP_ID, store.snapshot(), input.processorFilters, store);
  logger.info("step completed", { step: 2 });

  logger.info("step start", { step: 3, action: "writing discovery-model", outputDir: input.outputDir });
  new DiscoveryModelWriter().write({
    outputDir: input.outputDir,
    store,
    scannedAt: new Date(),
  });
  logger.info("step completed", { step: 3, outputDir: input.outputDir });

  logger.info("flow completed", { outputDir: input.outputDir, repositoryCount });
}
