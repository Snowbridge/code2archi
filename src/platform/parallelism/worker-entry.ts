import { performance } from "node:perf_hooks";
import { parentPort, workerData } from "node:worker_threads";
import "../processors/builtin-processors.js";
import { METRIC_WORKER_PHASE_SETUP } from "../profiling/metric-types.js";
import {
  DEFAULT_SCAN_IO_CACHE_OPTIONS,
  initScanIoCache,
  type ScanIoCacheOptions,
} from "../scan-io/index.js";
import { dispatchWorkerTask } from "./worker-dispatch.js";
import { initWorkerRuntime, resetWorkerRuntime, workerRecordValue } from "./worker-runtime.js";
import { setWorkerPhase } from "./worker-phase-context.js";
import type { WorkerInboundMessage, WorkerOutboundMessage } from "./worker-messages.js";

const threadId = typeof workerData?.threadId === "string" ? workerData.threadId : "worker";
const scanIoCache =
  workerData?.scanIoCache && typeof workerData.scanIoCache === "object"
    ? (workerData.scanIoCache as ScanIoCacheOptions)
    : DEFAULT_SCAN_IO_CACHE_OPTIONS;

initScanIoCache(scanIoCache);

function postEvent(message: WorkerOutboundMessage): void {
  parentPort?.postMessage(message);
}

function handlePhaseSetup(message: Extract<WorkerInboundMessage, { type: "phaseSetup" }>): void {
  initWorkerRuntime({
    threadId,
    postEvent,
    trackWorkerTaskMetrics: false,
  });

  const startedAt = performance.now();
  setWorkerPhase(message.phaseId, message.snapshot, message.snapshotFilterScope);
  workerRecordValue(METRIC_WORKER_PHASE_SETUP, performance.now() - startedAt, [message.phaseId]);

  parentPort?.postMessage({
    type: "phaseSetupAck",
    phaseId: message.phaseId,
  } satisfies WorkerOutboundMessage);
}

function handleTask(request: Extract<WorkerInboundMessage, { taskId: string }>): void {
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
}

parentPort?.on("message", (message: WorkerInboundMessage) => {
  if (message.type === "phaseSetup") {
    handlePhaseSetup(message);
    return;
  }

  handleTask(message);
});
