import { parentPort, workerData } from "node:worker_threads";
import "../../processors/builtin-processors.js";
import { dispatchWorkerTask } from "./worker-dispatch.js";
import { initWorkerRuntime, resetWorkerRuntime } from "./worker-runtime.js";
import type { WorkerOutboundMessage, WorkerTaskRequest } from "./worker-messages.js";

const threadId = typeof workerData?.threadId === "string" ? workerData.threadId : "worker";

function postEvent(message: WorkerOutboundMessage): void {
  parentPort?.postMessage(message);
}

parentPort?.on("message", (request: WorkerTaskRequest) => {
  initWorkerRuntime({
    threadId,
    postEvent,
    trackWorkerTaskMetrics: request.trackWorkerTaskMetrics,
  });

  try {
    const result = dispatchWorkerTask(request);
    parentPort?.postMessage({
      type: "taskResult",
      taskId: request.taskId,
      result,
    } satisfies WorkerOutboundMessage);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    parentPort?.postMessage({
      type: "taskError",
      taskId: request.taskId,
      message,
      stack,
    } satisfies WorkerOutboundMessage);
  } finally {
    resetWorkerRuntime();
  }
});
