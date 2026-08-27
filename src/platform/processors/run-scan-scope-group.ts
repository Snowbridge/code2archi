import path from "node:path";
import type { ProcessorFilters } from "./processor-filters.js";
import { processorRegistry } from "./processor-registry.js";
import type { ScanScopeInput, ScanScopeOutput } from "./scan-scope-types.js";

export function runScanScopeGroup(
  input: ScanScopeInput,
  filters: ProcessorFilters,
): ScanScopeOutput {
  const processors = processorRegistry.listFiltered<ScanScopeInput, ScanScopeOutput>(
    "scan-scope",
    filters,
  );

  const repoRoots = new Set<string>();
  for (const processor of processors) {
    const output = processor.process(input);
    if (output instanceof Promise) {
      throw new Error(
        `Processor ${processor.id.groupId}/${processor.id.artifactId} returned a Promise; sync execution expected`,
      );
    }

    for (const repoRoot of output) {
      repoRoots.add(path.resolve(repoRoot));
    }
  }

  return [...repoRoots].sort();
}
