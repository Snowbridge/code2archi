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

  const repositories = new Map<string, ScanScopeOutput[number]>();
  for (const processor of processors) {
    const output = processor.process(input);
    if (output instanceof Promise) {
      throw new Error(
        `Processor ${processor.id.groupId}/${processor.id.artifactId} returned a Promise; sync execution expected`,
      );
    }

    for (const repository of output) {
      if (repositories.has(repository.id)) {
        throw new Error(`Duplicate repository id: ${repository.id}`);
      }
      repositories.set(repository.id, repository);
    }
  }

  return [...repositories.values()].sort((a, b) => a.id.localeCompare(b.id));
}
