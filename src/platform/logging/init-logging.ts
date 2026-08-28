import { createLogger, transports, type Logger as WinstonLogger } from "winston";
import type { LogLevel } from "../../cli/processor-groups.js";
import { resolveLogFilePath } from "./resolve-log-file-path.js";
import { tsvFormat } from "./tsv-format.js";
import type { LoggingInitOptions } from "./types.js";

let rootLogger: WinstonLogger | null = null;
let currentLogLevel: LogLevel = "INFO";
let shutdownRegistered = false;

function winstonLevel(logLevel: LogLevel): string {
  return logLevel === "DEBUG" ? "debug" : "info";
}

function registerShutdown(): void {
  if (shutdownRegistered) {
    return;
  }
  shutdownRegistered = true;

  const close = (): void => {
    if (rootLogger) {
      for (const transport of rootLogger.transports) {
        transport.close?.();
      }
    }
  };

  process.on("exit", close);
  process.on("beforeExit", close);
}

export function initLogging(options: LoggingInitOptions): void {
  currentLogLevel = options.logLevel;
  const logFilePath = resolveLogFilePath(options.logDirectory);
  const level = winstonLevel(options.logLevel);

  rootLogger = createLogger({
    level,
    transports: [
      new transports.File({
        filename: logFilePath,
        level,
        format: tsvFormat,
      }),
      ...(options.verbose
        ? [
            new transports.Stream({
              stream: process.stderr,
              level,
              format: tsvFormat,
            }),
          ]
        : []),
    ],
  });

  registerShutdown();
}

export function getRootLogger(): WinstonLogger {
  if (!rootLogger) {
    throw new Error("Logging is not initialized; call initLogging() first");
  }
  return rootLogger;
}

export function isLoggingInitialized(): boolean {
  return rootLogger !== null;
}

export function isDebugEnabled(): boolean {
  return rootLogger !== null && currentLogLevel === "DEBUG";
}

export function resetLoggingForTests(): void {
  rootLogger = null;
  currentLogLevel = "INFO";
  shutdownRegistered = false;
}
