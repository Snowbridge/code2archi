import type { ProcessorGroupId } from "../../cli/processor-groups.js";
import type { CreateIntents } from "../../discovery-model/create-intents.js";
import type { DiscoveryModelSnapshot } from "../../discovery-model/discovery-model-snapshot.js";
import type { RunEntityStore } from "../../discovery-model/run-entity-store.js";
import type { ProcessorFilters } from "./processor-filters.js";
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
  groupId: Extract<ProcessorGroupId, "scan-tech" | "scan-app">,
  snapshot: DiscoveryModelSnapshot,
  filters: ProcessorFilters,
  store: RunEntityStore,
): void {
  const logger = getLogger(`scan.${groupId}`);
  logger.info("group start", { groupId });

  const processors = processorRegistry.listFiltered<
    DiscoveryModelSnapshot,
    CreateIntents
  >(groupId, filters);

  for (const processor of processors) {
    const processorLogger = getLogger(
      `processor.${processor.id.groupId}.${processor.id.artifactId}`,
    );
    processorLogger.info("processor start");

    const output = processor.process(snapshot);
    if (output instanceof Promise) {
      throw new Error(
        `Processor ${processor.id.groupId}/${processor.id.artifactId} returned a Promise; sync execution expected`,
      );
    }

    const count = countCreateIntents(output);
    if (!output.entities && !output.links) {
      processorLogger.info("processor completed", { count: 0 });
      continue;
    }

    store.addCreateIntents(groupId, processor.id, output);
    processorLogger.info("processor completed", { count });
  }

  logger.info("group completed", { groupId });
}
