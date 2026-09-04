export type { ParallelismOptions } from "./parallelism-options.js";
export { effectiveThreadCount, shouldUseWorkerThreads } from "./parallelism-options.js";
export { createMainThreadBridge, type MainThreadBridge } from "./main-thread-bridge.js";
export { createWorkerPool, type WorkerPool, type WorkerPoolRunResult, type WorkerPhaseSetup } from "./worker-pool.js";
export {
  serializeDiscoverySnapshot,
  serializeArchiSnapshot,
} from "./snapshot-serialization.js";
export {
  buildScanSourceTasks,
  buildScanLinkTasks,
  buildScanScopeTasks,
  buildGenerateProcessorTasks,
} from "./task-planner.js";
export {
  WORKER_HANDLER_GENERATE_PROCESSOR,
  WORKER_HANDLER_SCAN_PROCESSOR,
  WORKER_HANDLER_SCAN_SCOPE_UNIT,
} from "./worker-handler-id.js";
