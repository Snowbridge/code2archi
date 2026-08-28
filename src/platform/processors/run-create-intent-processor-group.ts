import type { ProcessorGroupId } from "../../cli/processor-groups.js";
import type { CreateIntents } from "../../discovery-model/create-intents.js";
import type { DiscoveryModelSnapshot } from "../../discovery-model/discovery-model-snapshot.js";
import type { RunEntityStore } from "../../discovery-model/run-entity-store.js";
import type { ProcessorFilters } from "./processor-filters.js";
import { processorRegistry } from "./processor-registry.js";

export function runCreateIntentProcessorGroup(
  groupId: Extract<ProcessorGroupId, "scan-tech" | "scan-app">,
  snapshot: DiscoveryModelSnapshot,
  filters: ProcessorFilters,
  store: RunEntityStore,
): void {
  const processors = processorRegistry.listFiltered<
    DiscoveryModelSnapshot,
    CreateIntents
  >(groupId, filters);

  for (const processor of processors) {
    const output = processor.process(snapshot);
    if (output instanceof Promise) {
      throw new Error(
        `Processor ${processor.id.groupId}/${processor.id.artifactId} returned a Promise; sync execution expected`,
      );
    }

    if (!output.entities && !output.links) {
      continue;
    }

    store.addCreateIntents(groupId, processor.id, output);
  }
}
