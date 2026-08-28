import { format } from "winston";
import { appendContext } from "./format-context.js";
import { escapeMessage } from "./escape-message.js";
import { formatLoggerName } from "./format-logger-name.js";
import { formatLogRecordTimestamp } from "../timestamp.js";

export const tsvFormat = format.printf((info) => {
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
