import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLogger, format, transports, type Logger as WinstonLogger } from "winston";
import type { LogLevel } from "../../cli/processor-groups.js";
import { formatLogFileTimestamp, formatLogRecordTimestamp } from "../timestamp.js";

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

let rootLogger: WinstonLogger | null = null;
let currentLogLevel: LogLevel = "INFO";
let shutdownRegistered = false;

const nullLogger: Logger = {
  info() {},
  warn() {},
  debug() {},
};

function winstonLevel(logLevel: LogLevel): string {
  return logLevel === "DEBUG" ? "debug" : "info";
}

function getRootLogger(): WinstonLogger {
  if (!rootLogger) {
    throw new Error("Logging is not initialized; call initLogging() first");
  }
  return rootLogger;
}

function escapeMessage(message: string): string {
  return message
    .replace(/\\/g, "\\\\")
    .replace(/\t/g, "\\t")
    .replace(/\r/g, "\\n")
    .replace(/\n/g, "\\n");
}

function formatContextValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function appendContext(message: string, context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) {
    return message;
  }

  const pairs = Object.entries(context).map(
    ([key, value]) => `${key}=${formatContextValue(value)}`,
  );
  return `${message} ${pairs.join(" ")}`.trim();
}

function formatLoggerName(name: string): string {
  return `[${name}]`;
}

const tsvFormat = format.printf((info) => {
  const timestamp = formatLogRecordTimestamp();
  const level = String(info.level).toLowerCase();
  const loggerName = formatLoggerName(String(info.loggerName ?? "unknown"));
  const context =
    info.context && typeof info.context === "object"
      ? (info.context as Record<string, unknown>)
      : undefined;
  const fullMessage = appendContext(String(info.message ?? ""), context);
  const message = escapeMessage(fullMessage);

  return `${timestamp}\t${level}\t${loggerName}\t${message}`;
});

export function resolveLogFilePath(
  logDirectory: string = os.tmpdir(),
  date: Date = new Date(),
): string {
  const timestamp = formatLogFileTimestamp(date);
  const baseName = `code2archi-${timestamp}`;
  let candidate = path.join(logDirectory, `${baseName}.log`);

  if (!existsSync(candidate)) {
    return candidate;
  }

  let suffix = 2;
  while (existsSync(candidate)) {
    candidate = path.join(logDirectory, `${baseName}-${suffix}.log`);
    suffix += 1;
  }

  return candidate;
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

function writeLog(
  level: "info" | "warn" | "debug",
  name: string,
  message: string,
  context?: Record<string, unknown>,
): void {
  getRootLogger().log(level, message, { loggerName: name, context });
}

export function getLogger(name: string): Logger {
  if (!isLoggingInitialized()) {
    return nullLogger;
  }

  return {
    info(message, context) {
      writeLog("info", name, message, context);
    },
    warn(message, context) {
      writeLog("warn", name, message, context);
    },
    debug(message, context) {
      writeLog("debug", name, message, context);
    },
  };
}

export async function shutdownLoggingAsync(): Promise<void> {
  if (!isLoggingInitialized()) {
    return;
  }

  const logger = getRootLogger();
  await new Promise<void>((resolve) => {
    logger.on("finish", resolve);
    logger.end();
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function errorStack(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  return undefined;
}

export function logError(
  logger: Logger,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  logger.info(`error ${errorMessage(error)}`, context);
  if (isDebugEnabled()) {
    const stack = errorStack(error);
    if (stack) {
      logger.debug("stack trace", { stack });
    }
  }
}
