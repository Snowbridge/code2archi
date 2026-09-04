import {
  WORKER_HANDLER_GENERATE_PROCESSOR,
  WORKER_HANDLER_SCAN_PROCESSOR,
  WORKER_HANDLER_SCAN_SCOPE_UNIT,
  type WorkerHandlerId,
} from "./worker-handler-id.js";
import { runGenerateProcessorTask } from "./handlers/generate-handlers.js";
import { runScanProcessorTask, runScanScopeUnitTask } from "./handlers/scan-handlers.js";
import { recordWorkerTaskOutcome } from "./worker-runtime.js";
import type { WorkerTaskRequest } from "./worker-messages.js";

export function dispatchWorkerTask(request: WorkerTaskRequest): unknown {
  let success = false;
  try {
    const result = executeHandler(request.handlerId as WorkerHandlerId, request.input);
    success = true;
    return result;
  } finally {
    if (request.trackWorkerTaskMetrics) {
      recordWorkerTaskOutcome(success);
    }
  }
}

function executeHandler(handlerId: WorkerHandlerId, input: unknown): unknown {
  switch (handlerId) {
    case WORKER_HANDLER_SCAN_PROCESSOR:
      return runScanProcessorTask(input as Parameters<typeof runScanProcessorTask>[0]);
    case WORKER_HANDLER_SCAN_SCOPE_UNIT:
      return runScanScopeUnitTask(input as Parameters<typeof runScanScopeUnitTask>[0]);
    case WORKER_HANDLER_GENERATE_PROCESSOR:
      return runGenerateProcessorTask(input as Parameters<typeof runGenerateProcessorTask>[0]);
    default:
      throw new Error(`Unknown worker handler: ${handlerId}`);
  }
}
