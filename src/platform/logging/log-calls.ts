import type { ProcessorId } from "../processors/processor-id.js";
import { getLogger, isDebugEnabled, logError } from "./logging.js";

const MAX_STRING_LENGTH = 500;
const MAX_DEPTH = 3;

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_STRING_LENGTH)}…`;
}

function serializeValue(value: unknown, depth = 0): string {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return truncateString(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (depth >= MAX_DEPTH) {
    return "[MaxDepth]";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeValue(item, depth + 1)).join(", ")}]`;
  }
  if (typeof value === "object") {
    try {
      return truncateString(
        JSON.stringify(value, (_, nested) => {
          if (typeof nested === "string") {
            return truncateString(nested);
          }
          return nested;
        }),
      );
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function serializeArgs(args: unknown[]): string {
  if (args.length === 0) {
    return "";
  }
  return args.map((arg) => serializeValue(arg)).join(", ");
}

export function processorLoggerName(id: ProcessorId): string {
  return `processor.${id.groupId}.${id.artifactId}`;
}

function logLeave(
  logger: ReturnType<typeof getLogger>,
  methodName: string,
  result: unknown,
): void {
  if (result === undefined) {
    logger.debug(`leave ${methodName}`, { status: "completed" });
    return;
  }
  logger.debug(`leave ${methodName}`, { result: serializeValue(result) });
}

function wrapMethod(
  original: (...args: unknown[]) => unknown,
  methodName: string,
  loggerName: string,
): (...args: unknown[]) => unknown {
  return function (this: unknown, ...args: unknown[]) {
    if (!isDebugEnabled()) {
      return original.apply(this, args);
    }

    const logger = getLogger(loggerName);
    logger.debug(`enter ${methodName}`, { args: serializeArgs(args) });

    try {
      const result = original.apply(this, args);
      if (result instanceof Promise) {
        return result.then(
          (value) => {
            logLeave(logger, methodName, value);
            return value;
          },
          (error) => {
            logError(logger, error, { method: methodName });
            throw error;
          },
        );
      }

      logLeave(logger, methodName, result);
      return result;
    } catch (error) {
      logError(logger, error, { method: methodName });
      throw error;
    }
  };
}

/** DEBUG trace wrapper for standalone functions and class fields. */
export function logCalls<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  loggerName: string,
  methodName = fn.name || "anonymous",
): (...args: TArgs) => TReturn {
  return wrapMethod(fn as (...args: unknown[]) => unknown, methodName, loggerName) as (
    ...args: TArgs
  ) => TReturn;
}
