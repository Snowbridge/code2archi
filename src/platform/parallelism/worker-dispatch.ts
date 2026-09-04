import { performance } from "node:perf_hooks";
import {
  WORKER_HANDLER_GENERATE_PROCESSOR,
  WORKER_HANDLER_SCAN_PROCESSOR,
  WORKER_HANDLER_SCAN_REPOSITORY_BATCH,
  WORKER_HANDLER_SCAN_SCOPE_UNIT,
  type WorkerHandlerId,
} from "./worker-handler-id.js";
import { runGenerateProcessorTask } from "./handlers/generate-handlers.js";
import {
  runScanProcessorTask,
  runScanRepositoryBatchTask,
  runScanScopeUnitTask,
} from "./handlers/scan-handlers.js";
import { recordValue } from "../profiling/index.js";
import { METRIC_WORKER_TASK_DURATION } from "../profiling/metric-types.js";
import type { ProcessorId } from "../processors/processor.js";
import { recordWorkerTaskOutcome } from "./worker-runtime.js";
import type { WorkerTaskRequest } from "./worker-messages.js";
import type { GenerateProcessorTaskInput } from "./task-inputs.js";
import type { ScanProcessorTaskInput, ScanScopeUnitTaskInput } from "./task-inputs.js";

export function dispatchWorkerTask(request: WorkerTaskRequest): unknown {
  const startedAt = performance.now();
  let success = false;
  try {
    const result = executeHandler(request.handlerId as WorkerHandlerId, request.input);
    success = true;
    return result;
  } finally {
    const durationMs = performance.now() - startedAt;
    const processorId = extractProcessorId(request.handlerId as WorkerHandlerId, request.input);
    if (processorId) {
      recordValue(METRIC_WORKER_TASK_DURATION, durationMs, [
        processorId.groupId,
        processorId.artifactId,
      ]);
    }
    if (request.trackWorkerTaskMetrics) {
      recordWorkerTaskOutcome(success);
    }
  }
}

function extractProcessorId(handlerId: WorkerHandlerId, input: unknown): ProcessorId | undefined {
  switch (handlerId) {
    case WORKER_HANDLER_SCAN_PROCESSOR:
      return (input as ScanProcessorTaskInput).processor;
    case WORKER_HANDLER_SCAN_REPOSITORY_BATCH:
      return undefined;
    case WORKER_HANDLER_SCAN_SCOPE_UNIT:
      return (input as ScanScopeUnitTaskInput).processor;
    case WORKER_HANDLER_GENERATE_PROCESSOR:
      return (input as GenerateProcessorTaskInput).processor;
    default:
      return undefined;
  }
}

function executeHandler(handlerId: WorkerHandlerId, input: unknown): unknown {
  switch (handlerId) {
    case WORKER_HANDLER_SCAN_PROCESSOR:
      return runScanProcessorTask(input as Parameters<typeof runScanProcessorTask>[0]);
    case WORKER_HANDLER_SCAN_REPOSITORY_BATCH:
      return runScanRepositoryBatchTask(
        input as Parameters<typeof runScanRepositoryBatchTask>[0],
      );
    case WORKER_HANDLER_SCAN_SCOPE_UNIT:
      return runScanScopeUnitTask(input as Parameters<typeof runScanScopeUnitTask>[0]);
    case WORKER_HANDLER_GENERATE_PROCESSOR:
      return runGenerateProcessorTask(input as Parameters<typeof runGenerateProcessorTask>[0]);
    default:
      throw new Error(`Unknown worker handler: ${handlerId}`);
  }
}
