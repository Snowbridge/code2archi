import type { BuiltInProcessorGroupId } from "../../cli/processor-groups.js";
import type { CreateIntents } from "../../discovery-model/entities/create-intents.js";
import type { DiscoveryModelSnapshot } from "../../discovery-model/run-entity-store.js";
import type { RunEntityStore } from "../../discovery-model/run-entity-store.js";
import type { ProcessorFilters } from "./processor-registry.js";
import { processorRegistry } from "./processor-registry.js";
import { getLogger } from "../logging/index.js";

function countCreateIntents(output: CreateIntents): number {
  let count = 0;
  if (output.entities) {
    for (const entities of Object.values(output.entities)) {
      if (entities) {
        count += entities.length;
      }
    }
  }
  if (output.links) {
    for (const links of Object.values(output.links)) {
      if (links) {
        count += links.length;
      }
    }
  }
  return count;
}

export function runCreateIntentProcessorGroup(
  builtInGroupId: BuiltInProcessorGroupId,
  snapshot: DiscoveryModelSnapshot,
  filters: ProcessorFilters,
  store: RunEntityStore,
): void {
  const logger = getLogger(`scan.${builtInGroupId}`);
  logger.info("group start", { groupId: builtInGroupId });

  const processors = processorRegistry.listForBuiltInStep<
    DiscoveryModelSnapshot,
    CreateIntents
  >(builtInGroupId, filters);

  for (const processor of processors) {
    processor.logStart();

    const output = processor.process(snapshot);
    if (output instanceof Promise) {
      throw new Error(
        `Processor ${processor.id.groupId}/${processor.id.artifactId} returned a Promise; sync execution expected`,
      );
    }

    const count = countCreateIntents(output);
    if (!output.entities && !output.links) {
      processor.logCompleted(0);
      continue;
    }

    store.addCreateIntents(builtInGroupId, processor.id, output);
    processor.logCompleted(count);
  }

  logger.info("group completed", { groupId: builtInGroupId });
}
