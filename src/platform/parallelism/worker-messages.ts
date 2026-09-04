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

export interface WorkerTaskRequest {
  readonly type?: "task";
  readonly taskId: string;
  readonly handlerId: string;
  readonly input: unknown;
  readonly trackWorkerTaskMetrics: boolean;
}

export interface WorkerPhaseSetupMessage {
  readonly type: "phaseSetup";
  readonly phaseId: string;
  readonly snapshot: import("./snapshot-serialization.js").SerializableDiscoverySnapshot;
  readonly snapshotFilterScope: import("./snapshot-serialization.js").SnapshotRepositoryFilterScope;
}

export interface WorkerPhaseSetupAckMessage {
  readonly type: "phaseSetupAck";
  readonly phaseId: string;
}

export type WorkerInboundMessage = WorkerPhaseSetupMessage | WorkerTaskRequest;

export type WorkerOutboundMessage =
  | WorkerLogMessage
  | WorkerProgressMessage
  | WorkerMetricMessage
  | WorkerTaskResultMessage
  | WorkerTaskErrorMessage
  | WorkerPhaseSetupAckMessage;
