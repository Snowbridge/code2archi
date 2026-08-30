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
    hidden: true,
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
  "with-scan-scope": arrayOption("Enable ON_DEMAND scan-scope processors by artifactId"),
  "with-scan-tech": arrayOption("Enable ON_DEMAND scan-tech processors by artifactId"),
  "with-scan-app": arrayOption("Enable ON_DEMAND scan-app processors by artifactId"),
  "with-generate-biz": arrayOption("Enable ON_DEMAND generate-biz processors by artifactId"),
  "with-generate-app": arrayOption("Enable ON_DEMAND generate-app processors by artifactId"),
  "with-generate-tech": arrayOption("Enable ON_DEMAND generate-tech processors by artifactId"),
  "with-generate-rel": arrayOption("Enable ON_DEMAND generate-rel processors by artifactId"),
  "with-generate-view": arrayOption("Enable ON_DEMAND generate-view processors by artifactId"),
  "without-scan-scope": arrayOption("Exclude scan-scope processors by artifactId"),
  "without-scan-tech": arrayOption("Exclude scan-tech processors by artifactId"),
  "without-scan-app": arrayOption("Exclude scan-app processors by artifactId"),
  "without-generate-biz": arrayOption("Exclude generate-biz processors by artifactId"),
  "without-generate-app": arrayOption("Exclude generate-app processors by artifactId"),
  "without-generate-tech": arrayOption("Exclude generate-tech processors by artifactId"),
  "without-generate-rel": arrayOption("Exclude generate-rel processors by artifactId"),
  "without-generate-view": arrayOption("Exclude generate-view processors by artifactId"),
  "with-only-scan-scope": arrayOption("Run only listed scan-scope processors"),
  "with-only-scan-tech": arrayOption("Run only listed scan-tech processors"),
  "with-only-scan-app": arrayOption("Run only listed scan-app processors"),
  "with-only-generate-biz": arrayOption("Run only listed generate-biz processors"),
  "with-only-generate-app": arrayOption("Run only listed generate-app processors"),
  "with-only-generate-tech": arrayOption("Run only listed generate-tech processors"),
  "with-only-generate-rel": arrayOption("Run only listed generate-rel processors"),
  "with-only-generate-view": arrayOption("Run only listed generate-view processors"),
};
