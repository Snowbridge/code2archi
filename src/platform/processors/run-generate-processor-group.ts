import type { BuiltInProcessorGroupId } from "../../cli/processor-groups.js";
import type { ArchiCreateIntents } from "../../archimate-model/archi-create-intents.js";
import type { ArchiModelStore } from "../../archimate-model/archi-model-store.js";
import type { DiscoveryModelSnapshot } from "../../discovery-model/run-entity-store.js";
import type { GenerateProcessorInput } from "./processor.js";
import type { ProcessorFilters } from "./processor-registry.js";
import { processorRegistry } from "./processor-registry.js";
import { getLogger } from "../logging/index.js";

function countArchiCreateIntents(output: ArchiCreateIntents): number {
  return (
    (output.folders?.length ?? 0) +
    (output.elements?.length ?? 0) +
    (output.profiles?.length ?? 0) +
    (output.relations?.length ?? 0)
  );
}

export function runGenerateProcessorGroup(
  builtInGroupId: BuiltInProcessorGroupId,
  discovery: DiscoveryModelSnapshot,
  archiStore: ArchiModelStore,
  filters: ProcessorFilters,
): void {
  const logger = getLogger(`generate.${builtInGroupId}`);
  logger.info("group start", { groupId: builtInGroupId });

  const processors = processorRegistry.listForBuiltInStep<GenerateProcessorInput, ArchiCreateIntents>(
    builtInGroupId,
    filters,
  );

  for (const processor of processors) {
    processor.logStart();

    const input: GenerateProcessorInput = {
      discovery,
      archi: archiStore.snapshot(),
    };
    const output = processor.process(input);
    if (output instanceof Promise) {
      throw new Error(
        `Processor ${processor.id.groupId}/${processor.id.artifactId} returned a Promise; sync execution expected`,
      );
    }

    const count = countArchiCreateIntents(output);
    if (
      !output.folders?.length &&
      !output.elements?.length &&
      !output.profiles?.length &&
      !output.relations?.length
    ) {
      processor.logCompleted(0);
      continue;
    }

    archiStore.addCreateIntents(builtInGroupId, processor.id, output);
    processor.logCompleted(count);
  }

  logger.info("group completed", { groupId: builtInGroupId });
}
