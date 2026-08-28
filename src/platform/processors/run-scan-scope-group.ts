import type { RunEntityStore } from "../../discovery-model/run-entity-store.js";
import type { ProcessorFilters } from "./processor-filters.js";
import { processorRegistry } from "./processor-registry.js";
import type { ScanScopeInput, ScanScopeOutput } from "./scan-scope-types.js";

export function runScanScopeGroup(
  input: ScanScopeInput,
  filters: ProcessorFilters,
  store: RunEntityStore,
): void {
  const processors = processorRegistry.listFiltered<ScanScopeInput, ScanScopeOutput>(
    "scan-scope",
    filters,
  );

  for (const processor of processors) {
    const output = processor.process(input);
    if (output instanceof Promise) {
      throw new Error(
        `Processor ${processor.id.groupId}/${processor.id.artifactId} returned a Promise; sync execution expected`,
      );
    }

    if (output.length === 0) {
      continue;
    }

    store.addCreateIntents("scan-scope", processor.id, {
      entities: {
        Repository: [...output],
      },
    });
  }
}
