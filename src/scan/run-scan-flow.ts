import type { ProcessorFilters } from "../platform/processors/processor-filters.js";
import { resolveProcessorFilters } from "../platform/processors/resolve-processor-filters.js";
import { runScanScopeGroup } from "../platform/processors/run-scan-scope-group.js";
import type { GlobalArgv } from "../cli/processor-groups.js";
import { DiscoveryModelWriter } from "../discovery-model/discovery-model-writer.js";
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
  console.log("[scan] step 1/4: repository discovery (scan-scope)");
  const repositories = runScanScopeGroup(input.sourceDirs, input.processorFilters);
  console.log(`[scan] found ${repositories.length} repository(ies)`);

  console.log("[scan] step 2/4: technology layer discovery (scan-tech)");
  console.log(`[scan] scan-tech input: ${repositories.length} repository(ies)`);

  console.log("[scan] step 3/4: application layer discovery (scan-app)");
  console.log(`[scan] step 4/4: writing discovery-model to ${input.outputDir}`);
  new DiscoveryModelWriter().write({
    outputDir: input.outputDir,
    sourceDirs: input.sourceDirs,
    repositories,
    scanId: input.scanId,
    scannedAt: new Date(),
  });
}
