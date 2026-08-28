import { getRootLogger, isLoggingInitialized } from "./init-logging.js";
import type { Logger } from "./types.js";

const nullLogger: Logger = {
  info() {},
  warn() {},
  debug() {},
};

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
