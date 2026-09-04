import type { BuiltInProcessorGroupId } from "../../cli/processor-groups.js";
import type { StepProgressHandle } from "../cli-progress/types.js";
import type { ArchiCreateIntents } from "../../archimate-model/archi-create-intents.js";
import type { ArchiModelStore } from "../../archimate-model/archi-model-store.js";
import type { DiscoveryModelSnapshot } from "../../discovery-model/run-entity-store.js";
import { WORKER_HANDLER_GENERATE_PROCESSOR } from "../parallelism/worker-handler-id.js";
import {
  buildGenerateProcessorTasks,
  serializeArchiSnapshot,
  serializeDiscoverySnapshot,
} from "../parallelism/index.js";
import { runProcessorWithMetrics } from "../profiling/flow-metrics.js";
import type { GenerateProcessorInput, GenerateOptions } from "./processor.js";
import type { ProcessorFilters } from "./processor-registry.js";
import { processorRegistry } from "./processor-registry.js";
import { getLogger } from "../logging/index.js";
import type { ProcessorGroupParallelContext } from "./run-create-intent-processor-group.js";
import { throwOnPoolErrors } from "./parallel-group-runner.js";

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
  options: GenerateOptions,
  progress?: StepProgressHandle,
  parallel?: ProcessorGroupParallelContext,
): void {
  const logger = getLogger(`generate.${builtInGroupId}`);
  logger.info("group start", { groupId: builtInGroupId });

  const processors = processorRegistry.listForBuiltInStep<GenerateProcessorInput, ArchiCreateIntents>(
    builtInGroupId,
    filters,
  );

  if (processors.length === 0) {
    logger.info("group completed", { groupId: builtInGroupId });
    return;
  }

  if (!parallel) {
    for (const processor of processors) {
      processor.logStart();

      const input: GenerateProcessorInput = {
        discovery,
        archi: archiStore.snapshot(),
        options,
      };
      const output = runProcessorWithMetrics(processor.id, () => processor.process(input));
      if (output instanceof Promise) {
        throw new Error(
          `Processor ${processor.id.groupId}/${processor.id.artifactId} returned a Promise; sync execution expected`,
        );
      }

      const count = countArchiCreateIntents(output);
      if (count === 0) {
        processor.logCompleted(0);
        progress?.tick(1);
        continue;
      }

      archiStore.addCreateIntents(builtInGroupId, processor.id, output);
      processor.logCompleted(count);
      progress?.tick(1);
    }

    logger.info("group completed", { groupId: builtInGroupId });
    return;
  }

  const archiSnapshot = serializeArchiSnapshot(archiStore.snapshot());
  const discoverySnapshot = serializeDiscoverySnapshot(discovery);
  const tasks = buildGenerateProcessorTasks(
    processors,
    discoverySnapshot,
    archiSnapshot,
    options.decorate,
  );

  const { results, errors } = parallel.pool.runTasks({
    handlerId: WORKER_HANDLER_GENERATE_PROCESSOR,
    tasks,
    bridge: parallel.bridge,
  });
  throwOnPoolErrors(builtInGroupId, errors, parallel.continueOnError);

  for (const task of tasks) {
    const processor = processors.find(
      (candidate) =>
        candidate.id.groupId === task.input.processor.groupId &&
        candidate.id.artifactId === task.input.processor.artifactId,
    );
    if (!processor) {
      continue;
    }

    const output = results.get(task.taskId) as ArchiCreateIntents | undefined;
    if (!output) {
      processor.logCompleted(0);
      progress?.tick(1);
      continue;
    }

    const count = countArchiCreateIntents(output);
    if (count === 0) {
      processor.logCompleted(0);
      progress?.tick(1);
      continue;
    }

    archiStore.addCreateIntents(builtInGroupId, processor.id, output);
    processor.logCompleted(count);
    progress?.tick(1);
  }

  logger.info("group completed", { groupId: builtInGroupId });
}
