import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { CliError } from "../cli/cli-error.js";
import { ExitCode } from "../cli/exit-codes.js";
import { formatRunTimestamp } from "../platform/timestamp.js";

export interface ScanArgs {
  sourceDirs: string[];
  outputDir: string;
  force: boolean;
}

export interface ValidateScanArgsInput {
  sourceDirs: string[];
  output?: string;
  force: boolean;
  now?: Date;
}

export function validateScanArgs(input: ValidateScanArgsInput): ScanArgs {
  for (const sourceDir of input.sourceDirs) {
    if (!existsSync(sourceDir)) {
      throw new CliError(`Source directory does not exist: ${sourceDir}`);
    }
    if (!statSync(sourceDir).isDirectory()) {
      throw new CliError(`Source path is not a directory: ${sourceDir}`);
    }
  }

  const outputDir = input.output
    ? path.resolve(input.output)
    : path.resolve(
        process.cwd(),
        `code2archi-scan-${formatRunTimestamp(input.now ?? new Date())}`,
      );

  prepareOutputDir(outputDir, input.force);
  mkdirSync(outputDir, { recursive: true });

  return {
    sourceDirs: input.sourceDirs,
    outputDir,
    force: input.force,
  };
}

function prepareOutputDir(outputDir: string, force: boolean): void {
  if (!existsSync(outputDir)) {
    return;
  }

  const entries = readdirSync(outputDir);
  if (entries.length === 0) {
    return;
  }

  if (!force) {
    throw new CliError(
      `Output directory is not empty: ${outputDir}. Use --force to overwrite`,
      ExitCode.RUNTIME,
    );
  }

  rmSync(outputDir, { recursive: true, force: true });
}
