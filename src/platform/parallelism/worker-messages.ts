export type WorkerLogLevel = "info" | "warn" | "debug";

export interface WorkerLogMessage {
  readonly type: "log";
  readonly threadId: string;
  readonly level: WorkerLogLevel;
  readonly loggerName: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

export interface WorkerProgressMessage {
  readonly type: "progress";
  readonly stepId: string;
  readonly tick?: number;
  readonly setTotal?: number;
}

export interface WorkerMetricMessage {
  readonly type: "metric";
  readonly metricId: string;
  readonly value: number;
  readonly dimensions?: readonly string[];
}

export interface WorkerTaskResultMessage {
  readonly type: "taskResult";
  readonly taskId: string;
  readonly result: unknown;
}

export interface WorkerTaskErrorMessage {
  readonly type: "taskError";
  readonly taskId: string;
  readonly message: string;
  readonly stack?: string;
}

export type WorkerOutboundMessage =
  | WorkerLogMessage
  | WorkerProgressMessage
  | WorkerMetricMessage
  | WorkerTaskResultMessage
  | WorkerTaskErrorMessage;

export interface WorkerTaskRequest {
  readonly taskId: string;
  readonly handlerId: string;
  readonly input: unknown;
  readonly trackWorkerTaskMetrics: boolean;
}
