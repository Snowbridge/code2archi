export const WORKER_HANDLER_SCAN_PROCESSOR = "builtin.scan.processor" as const;
export const WORKER_HANDLER_SCAN_SCOPE_UNIT = "builtin.scan.scope-unit" as const;
export const WORKER_HANDLER_GENERATE_PROCESSOR = "builtin.generate.processor" as const;

export type WorkerHandlerId =
  | typeof WORKER_HANDLER_SCAN_PROCESSOR
  | typeof WORKER_HANDLER_SCAN_SCOPE_UNIT
  | typeof WORKER_HANDLER_GENERATE_PROCESSOR;
