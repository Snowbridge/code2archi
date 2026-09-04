import {
  getLogger as getRootLoggerImpl,
  initLogging,
  isDebugEnabled,
  isLoggingInitialized,
  logError,
  resetLoggingForTests,
  resolveLogFilePath,
  shutdownLoggingAsync,
  writeBridgedWorkerLog,
} from "./logging.js";
import { createWorkerLogger, isWorkerRuntimeActive } from "../parallelism/worker-runtime.js";

export function getLogger(name: string) {
  if (isWorkerRuntimeActive()) {
    return createWorkerLogger(name);
  }
  return getRootLoggerImpl(name);
}

export {
  initLogging,
  isDebugEnabled,
  isLoggingInitialized,
  logError,
  resetLoggingForTests,
  resolveLogFilePath,
  shutdownLoggingAsync,
  writeBridgedWorkerLog,
};
export type { Logger, LoggingInitOptions } from "./logging.js";
export { logCalls, processorLoggerName } from "./log-calls.js";
