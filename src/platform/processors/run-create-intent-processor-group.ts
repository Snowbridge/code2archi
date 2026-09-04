import type { BuiltInProcessorGroupId } from "../../cli/processor-groups.js";
import { SCAN_SOURCE_GROUP_ID } from "../../cli/processor-groups.js";
import type { StepProgressHandle } from "../cli-progress/types.js";
import type { CreateIntents } from "../../discovery-model/entities/create-intents.js";
import type { DiscoveryModelSnapshot, RunEntityStore } from "../../discovery-model/run-entity-store.js";
import { runProcessorWithMetrics } from "../profiling/flow-metrics.js";
import type { ProcessorFilters } from "./processor-registry.js";
import { processorRegistry } from "./processor-registry.js";
import type { ScanAppInput } from "./processor.js";
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
  filters: ProcessorFilters,
  store: RunEntityStore,
  progress?: StepProgressHandle,
): void {
  const logger = getLogger(`scan.${builtInGroupId}`);
  logger.info("group start", { groupId: builtInGroupId });

  const processors = processorRegistry.listForBuiltInStep<
    ScanAppInput,
    CreateIntents
  >(builtInGroupId, filters);

  const passProgress = builtInGroupId === SCAN_SOURCE_GROUP_ID && progress !== undefined;

  for (const processor of processors) {
    processor.logStart();

    const snapshot = store.snapshot();
    const input: ScanAppInput = passProgress
      ? new Proxy(snapshot, {
          get(target, prop, receiver) {
            if (prop === "progress") {
              return progress;
            }
            const value = Reflect.get(target, prop, receiver);
            return typeof value === "function" ? value.bind(target) : value;
          },
        })
      : snapshot;

    const output = runProcessorWithMetrics(processor.id, () => processor.process(input));
    if (output instanceof Promise) {
      throw new Error(
        `Processor ${processor.id.groupId}/${processor.id.artifactId} returned a Promise; sync execution expected`,
      );
    }

    const count = countCreateIntents(output);
    if (!output.entities && !output.links) {
      processor.logCompleted(0);
      if (builtInGroupId !== SCAN_SOURCE_GROUP_ID) {
        progress?.tick(1);
      }
      continue;
    }

    store.addCreateIntents(builtInGroupId, processor.id, output);
    processor.logCompleted(count);
    if (builtInGroupId !== SCAN_SOURCE_GROUP_ID) {
      progress?.tick(1);
    }
  }

  logger.info("group completed", { groupId: builtInGroupId });
}
