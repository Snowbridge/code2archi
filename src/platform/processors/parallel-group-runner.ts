import type { BuiltInProcessorGroupId } from "../../cli/processor-groups.js";
import type { CreateIntents } from "../../discovery-model/entities/create-intents.js";
import type { RunEntityStore } from "../../discovery-model/run-entity-store.js";
import type { MainThreadBridge } from "../parallelism/main-thread-bridge.js";
import type { WorkerPool } from "../parallelism/worker-pool.js";
import {
  WORKER_HANDLER_SCAN_PROCESSOR,
  WORKER_HANDLER_SCAN_REPOSITORY_BATCH,
} from "../parallelism/worker-handler-id.js";
import type { ScanRepositoryBatchTaskResult } from "../parallelism/task-inputs.js";
import { parseProcessorTaskKey } from "../parallelism/task-inputs.js";
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

export function mergeRepositoryBatchResults(
  builtInGroupId: BuiltInProcessorGroupId,
  store: RunEntityStore,
  results: ReadonlyMap<string, ScanRepositoryBatchTaskResult>,
): void {
  for (const [, batch] of results) {
    for (const [processorKey, output] of Object.entries(batch.outputs)) {
      const processorId = parseProcessorTaskKey(processorKey);
      if (!output.entities && !output.links) {
        continue;
      }
      store.addCreateIntents(builtInGroupId, processorId, output);
    }
  }
}

export function collectRepositoryBatchProcessorErrors(
  results: ReadonlyMap<string, ScanRepositoryBatchTaskResult>,
): Map<string, Error> {
  const errors = new Map<string, Error>();
  for (const [taskId, batch] of results) {
    if (!batch.errors) {
      continue;
    }
    for (const [processorKey, error] of Object.entries(batch.errors)) {
      const failure = new Error(error.message);
      if (error.stack) {
        failure.stack = error.stack;
      }
      errors.set(`${taskId}:${processorKey}`, failure);
    }
  }
  return errors;
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

export async function runScanProcessorPool(
  pool: WorkerPool,
  bridge: MainThreadBridge,
  tasks: ReadonlyArray<{ taskId: string; input: unknown }>,
  continueOnError: boolean,
  poolLabel: string,
): Promise<{
  readonly results: ReadonlyMap<string, CreateIntents>;
  readonly errors: ReadonlyMap<string, Error>;
}> {
  const { results, errors } = await pool.runTasks({
    handlerId: WORKER_HANDLER_SCAN_PROCESSOR,
    tasks,
    bridge,
  });

  throwOnPoolErrors(poolLabel, errors, continueOnError);
  return { results: results as ReadonlyMap<string, CreateIntents>, errors };
}

export async function runScanRepositoryBatchPool(
  pool: WorkerPool,
  bridge: MainThreadBridge,
  tasks: ReadonlyArray<{ taskId: string; input: unknown }>,
  continueOnError: boolean,
  poolLabel: string,
): Promise<{
  readonly results: ReadonlyMap<string, ScanRepositoryBatchTaskResult>;
  readonly errors: ReadonlyMap<string, Error>;
}> {
  const { results, errors } = await pool.runTasks({
    handlerId: WORKER_HANDLER_SCAN_REPOSITORY_BATCH,
    tasks,
    bridge,
  });

  throwOnPoolErrors(poolLabel, errors, continueOnError);
  return { results: results as ReadonlyMap<string, ScanRepositoryBatchTaskResult>, errors };
}
