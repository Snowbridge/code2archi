import type { LogLevel } from "../../cli/processor-groups.js";

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

export interface LoggingInitOptions {
  logLevel: LogLevel;
  verbose: boolean;
  logDirectory?: string;
}
