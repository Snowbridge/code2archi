import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { CliError } from "../cli/cli-error.js";
import { ExitCode } from "../cli/exit-codes.js";

const SCAN_DIR_PREFIX = "code2archi-scan-";

export function resolveLatestDiscoveryModelDir(cwd: string = process.cwd()): string {
  if (!existsSync(cwd)) {
    throw new CliError(`Working directory does not exist: ${cwd}`, ExitCode.ARGV);
  }

  const candidates = readdirSync(cwd)
    .filter((entry) => entry.startsWith(SCAN_DIR_PREFIX))
    .map((entry) => path.join(cwd, entry))
    .filter((entryPath) => existsSync(entryPath) && statSync(entryPath).isDirectory())
    .map((entryPath) => ({
      entryPath,
      timestamp: parseScanDirTimestamp(path.basename(entryPath)),
    }))
    .filter(
      (candidate): candidate is { entryPath: string; timestamp: Date } =>
        candidate.timestamp !== undefined,
    )
    .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime());

  if (candidates.length === 0) {
    throw new CliError(
      `No discovery-model directory found in ${cwd} (expected ${SCAN_DIR_PREFIX}<timestamp>)`,
      ExitCode.ARGV,
    );
  }

  return candidates[0]!.entryPath;
}

export function parseScanDirTimestamp(dirName: string): Date | undefined {
  if (!dirName.startsWith(SCAN_DIR_PREFIX)) {
    return undefined;
  }

  return parseRunTimestamp(dirName.slice(SCAN_DIR_PREFIX.length));
}

/** Inverse of formatRunTimestamp (YYYY-MM-DDTHH-mm-ss.mmmm±HHMM). */
export function parseRunTimestamp(value: string): Date | undefined {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})\.(\d+)([+-]\d{4})$/.exec(value);
  if (!match) {
    return undefined;
  }

  const [, year, month, day, hours, minutes, seconds, fractional, offset] = match;
  const milliseconds = Number(fractional.slice(0, 3).padEnd(3, "0"));
  const offsetSign = offset.startsWith("+") ? 1 : -1;
  const offsetHours = Number(offset.slice(1, 3));
  const offsetMinutes = Number(offset.slice(3, 5));
  const offsetTotalMinutes = offsetSign * (offsetHours * 60 + offsetMinutes);

  const utcMillis = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
    milliseconds,
  );

  return new Date(utcMillis - offsetTotalMinutes * 60_000);
}
