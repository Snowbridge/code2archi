import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { formatLogFileTimestamp } from "../timestamp.js";

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
