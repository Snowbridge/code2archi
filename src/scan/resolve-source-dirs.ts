import { readFileSync } from "node:fs";
import path from "node:path";
import { CliError } from "../cli/cli-error.js";

export function resolveSourceDirs(positionals: string[]): string[] {
  if (positionals.length === 0) {
    throw new CliError("Missing required argument: source-dir");
  }

  const atFileArgs = positionals.filter((arg) => arg.startsWith("@"));

  if (atFileArgs.length > 1) {
    throw new CliError("Only one @file source-dir list is allowed");
  }

  if (atFileArgs.length === 1) {
    if (positionals.length > 1) {
      throw new CliError("Cannot mix @file with literal source-dir paths");
    }
    return readSourceDirListFile(atFileArgs[0]!);
  }

  return positionals.map((dir) => path.resolve(dir));
}

function readSourceDirListFile(atArg: string): string[] {
  const filePath = atArg.slice(1);
  if (filePath.length === 0) {
    throw new CliError("Invalid @file path: empty path after @");
  }

  let content: string;
  try {
    content = readFileSync(path.resolve(filePath), "utf8");
  } catch {
    throw new CliError(`Cannot read source-dir list file: ${filePath}`);
  }

  const dirs = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => path.resolve(line));

  if (dirs.length === 0) {
    throw new CliError(`Source-dir list file is empty: ${filePath}`);
  }

  return dirs;
}
