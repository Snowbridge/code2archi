import { isDebugEnabled } from "./init-logging.js";
import type { Logger } from "./types.js";

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
