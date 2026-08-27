import os from "node:os";
import type { Options } from "yargs";
import { CliError } from "./cli-error.js";
import type { LogLevel } from "./processor-groups.js";

export function defaultThreadCount(): number {
  return Math.max(1, Math.floor(os.cpus().length / 2));
}

export function coerceLogLevel(value: unknown): LogLevel {
  const normalized = String(value).toUpperCase();
  if (normalized === "INFO" || normalized === "DEBUG") {
    return normalized;
  }
  throw new CliError(
    `Invalid --log-level: expected INFO or DEBUG, got "${String(value)}"`,
  );
}

export function coerceThreads(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new CliError("Invalid --threads: expected integer >= 1");
  }
  return parsed;
}

function arrayOption(description: string): Options {
  return {
    type: "array",
    string: true,
    default: [],
    describe: description,
  };
}

export const globalOptions: Record<string, Options> = {
  "log-level": {
    alias: "L",
    type: "string",
    default: "INFO",
    coerce: coerceLogLevel,
    describe: "Logging level (INFO or DEBUG)",
  },
  verbose: {
    alias: "V",
    type: "boolean",
    default: false,
    describe: "Duplicate TSV log to stderr",
  },
  profile: {
    type: "boolean",
    default: false,
    describe: "Profiling: JSON report in cwd",
  },
  threads: {
    type: "number",
    default: defaultThreadCount(),
    coerce: coerceThreads,
    describe: "Number of worker threads",
  },
  sync: {
    type: "boolean",
    default: false,
    describe: "Single-threaded mode without worker threads",
  },
  "continue-on-error": {
    type: "boolean",
    default: false,
    describe: "Do not abort worker pool on error; aggregate report",
  },
  "with-none": {
    type: "array",
    string: true,
    default: [],
    describe: "Disable all processors for listed groupIds",
  },
  "without-scan-scope": arrayOption("Exclude scan-scope processors by artifactId"),
  "without-scan-tech": arrayOption("Exclude scan-tech processors by artifactId"),
  "without-scan-source": arrayOption("Exclude scan-source processors by artifactId"),
  "without-generate-element": arrayOption(
    "Exclude generate-element processors by artifactId",
  ),
  "without-generate-relation": arrayOption(
    "Exclude generate-relation processors by artifactId",
  ),
  "without-generate-view": arrayOption(
    "Exclude generate-view processors by artifactId",
  ),
  "with-only-scan-scope": arrayOption("Run only listed scan-scope processors"),
  "with-only-scan-tech": arrayOption("Run only listed scan-tech processors"),
  "with-only-scan-source": arrayOption("Run only listed scan-source processors"),
  "with-only-generate-element": arrayOption(
    "Run only listed generate-element processors",
  ),
  "with-only-generate-relation": arrayOption(
    "Run only listed generate-relation processors",
  ),
  "with-only-generate-view": arrayOption("Run only listed generate-view processors"),
};
