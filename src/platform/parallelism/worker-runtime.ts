import type { StepProgressHandle } from "../cli-progress/types.js";
import type { Logger } from "../logging/logging.js";
import {
  METRIC_WORKER_TASK_ERROR,
  METRIC_WORKER_TASK_SUCCESS,
} from "../profiling/metric-types.js";
import type { WorkerOutboundMessage } from "./worker-messages.js";

export type WorkerEventSender = (message: WorkerOutboundMessage) => void;

let eventSender: WorkerEventSender | null = null;
let threadId = "main";
let trackWorkerTaskMetrics = false;

export function initWorkerRuntime(options: {
  readonly threadId: string;
  readonly postEvent: WorkerEventSender;
  readonly trackWorkerTaskMetrics?: boolean;
}): void {
  threadId = options.threadId;
  eventSender = options.postEvent;
  trackWorkerTaskMetrics = options.trackWorkerTaskMetrics ?? false;
}

export function resetWorkerRuntime(): void {
  eventSender = null;
  threadId = "main";
  trackWorkerTaskMetrics = false;
}

export function isWorkerRuntimeActive(): boolean {
  return eventSender !== null;
}

function postEvent(message: WorkerOutboundMessage): void {
  if (!eventSender) {
    return;
  }
  eventSender(message);
}

export function createWorkerLogger(name: string): Logger {
  return {
    info(message, context) {
      postEvent({ type: "log", threadId, level: "info", loggerName: name, message, context });
    },
    warn(message, context) {
      postEvent({ type: "log", threadId, level: "warn", loggerName: name, message, context });
    },
    debug(message, context) {
      postEvent({ type: "log", threadId, level: "debug", loggerName: name, message, context });
    },
  };
}

export function createWorkerProgressHandle(stepId: string): StepProgressHandle {
  return {
    tick(count = 1) {
      postEvent({ type: "progress", stepId, tick: count });
    },
    setTotal(total) {
      postEvent({ type: "progress", stepId, setTotal: total });
    },
  };
}

export function workerRecordValue(
  metricId: string,
  value: number,
  dimensions?: readonly string[],
): void {
  postEvent({ type: "metric", metricId, value, dimensions });
}

export function recordWorkerTaskOutcome(success: boolean): void {
  if (!trackWorkerTaskMetrics) {
    return;
  }
  workerRecordValue(success ? METRIC_WORKER_TASK_SUCCESS : METRIC_WORKER_TASK_ERROR, 1);
}

export function getWorkerThreadId(): string {
  return threadId;
}
