import os from "node:os";
import type { Options } from "yargs";
import { CliError } from "./cli-error.js";

export function defaultThreadCount(): number {
  return Math.max(1, Math.floor(os.cpus().length / 2));
}

export function coerceThreads(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new CliError("Invalid --threads: expected integer >= 1");
  }
  return parsed;
}

function processorFilterOption(description: string): Options {
  return {
    type: "array",
    string: true,
    default: [],
    describe: description,
  };
}

export const globalOptions: Record<string, Options> = {
  debug: {
    type: "boolean",
    default: false,
    describe: "Enable DEBUG logging and debug artifacts",
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
    describe: "Profiling: JSON metrics report in $TMP",
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
  with: processorFilterOption(
    "Enable ON_DEMAND processors by coordinate (groupId.artifactId) or wildcard prefix.*",
  ),
  without: processorFilterOption(
    "Exclude processors by coordinate (groupId.artifactId) or wildcard prefix.*",
  ),
  "with-only": processorFilterOption(
    "Global allow-list: run only processors matching coordinate or wildcard prefix.*; use 'none' to disable",
  ),
  supplement: {
    type: "array",
    string: true,
    default: [],
    describe: "Processor sidecar file: <coordinate>@<path> (repeatable)",
  },
  config: {
    type: "string",
    describe: "Path to run-config YAML, or 'none' to disable file discovery",
  },
};
