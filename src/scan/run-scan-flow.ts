import type { ProcessorFilters } from "../platform/processors/processor-filters.js";
import { resolveProcessorFilters } from "../platform/processors/resolve-processor-filters.js";
import { runScanAppGroup } from "../platform/processors/run-scan-app-group.js";
import { runScanScopeGroup } from "../platform/processors/run-scan-scope-group.js";
import { runScanTechGroup } from "../platform/processors/run-scan-tech-group.js";
import type { GlobalArgv } from "../cli/processor-groups.js";
import { DiscoveryModelWriter } from "../discovery-model/discovery-model-writer.js";
import { RunEntityStore } from "../discovery-model/run-entity-store.js";
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
  const store = new RunEntityStore({
    sourceDirs: input.sourceDirs,
    scanId: input.scanId,
    runStartedAt: input.runStartedAt,
  });

  console.log("[scan] step 1/4: repository discovery (scan-scope)");
  runScanScopeGroup(input.sourceDirs, input.processorFilters, store);
  const repositoryCount = store.getEntities("Repository").length;
  console.log(`[scan] found ${repositoryCount} repository(ies)`);

  console.log("[scan] step 2/4: technology layer discovery (scan-tech)");
  runScanTechGroup(store.snapshot(), input.processorFilters, store);

  console.log("[scan] step 3/4: application layer discovery (scan-app)");
  runScanAppGroup(store.snapshot(), input.processorFilters, store);

  console.log(`[scan] step 4/4: writing discovery-model to ${input.outputDir}`);
  new DiscoveryModelWriter().write({
    outputDir: input.outputDir,
    store,
    scannedAt: new Date(),
  });
}
