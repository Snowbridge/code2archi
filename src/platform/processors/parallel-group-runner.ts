import type { BuiltInProcessorGroupId } from "../../cli/processor-groups.js";
import type { CreateIntents } from "../../discovery-model/entities/create-intents.js";
import type { RunEntityStore } from "../../discovery-model/run-entity-store.js";
import type { MainThreadBridge } from "../parallelism/main-thread-bridge.js";
import type { WorkerPool } from "../parallelism/worker-pool.js";
import { WORKER_HANDLER_SCAN_PROCESSOR } from "../parallelism/worker-handler-id.js";
import type { ProcessorId } from "./processor.js";
import { getLogger } from "../logging/index.js";

export function mergeParallelCreateIntentResults(
  builtInGroupId: BuiltInProcessorGroupId,
  store: RunEntityStore,
  processorByTaskId: ReadonlyMap<string, ProcessorId>,
  results: ReadonlyMap<string, CreateIntents>,
): void {
  for (const [taskId, output] of results) {
    const processorId = processorByTaskId.get(taskId);
    if (!processorId) {
      throw new Error(`Missing processor mapping for task ${taskId}`);
    }

    if (!output.entities && !output.links) {
      continue;
    }

    store.addCreateIntents(builtInGroupId, processorId, output);
  }
}

export function throwOnPoolErrors(
  poolLabel: string,
  errors: ReadonlyMap<string, Error>,
  continueOnError: boolean,
): void {
  if (errors.size === 0) {
    return;
  }

  if (continueOnError) {
    const logger = getLogger("platform.parallelism");
    for (const [taskId, error] of errors) {
      logger.info("task failed", { pool: poolLabel, taskId, message: error.message });
    }
    throw new AggregateError(
      [...errors.values()],
      `${poolLabel}: ${errors.size} task(s) failed`,
    );
  }

  const firstError = [...errors.values()][0];
  throw firstError ?? new Error(`${poolLabel}: task failed`);
}

export function runScanProcessorPool(
  pool: WorkerPool,
  bridge: MainThreadBridge,
  tasks: ReadonlyArray<{ taskId: string; input: unknown }>,
  continueOnError: boolean,
  poolLabel: string,
): {
  readonly results: ReadonlyMap<string, CreateIntents>;
  readonly errors: ReadonlyMap<string, Error>;
} {
  const { results, errors } = pool.runTasks({
    handlerId: WORKER_HANDLER_SCAN_PROCESSOR,
    tasks,
    bridge,
  });

  throwOnPoolErrors(poolLabel, errors, continueOnError);
  return { results: results as ReadonlyMap<string, CreateIntents>, errors };
}
