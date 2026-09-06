import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { CliError } from "../cli/cli-error.js";
import { ExitCode } from "../cli/exit-codes.js";
import { ArchiModelStore } from "../archimate-model/archi-model-store.js";
import { resolveLatestCodeInventoryDir } from "./resolve-code-inventory-dir.js";

export interface GenerateArgs {
  outputFile: string;
  codeInventoryDir: string;
  force: boolean;
  noDecorate: boolean;
  modelName: string;
  modelId: string;
}

export interface ValidateGenerateArgsInput {
  outputFile: string;
  codeInventoryDir?: string;
  force: boolean;
  noDecorate: boolean;
}

export function validateGenerateArgs(input: ValidateGenerateArgsInput): GenerateArgs {
  if (!input.outputFile) {
    throw new CliError("Output file is required", ExitCode.ARGV);
  }

  const outputFile = ensureArchimateExtension(path.resolve(input.outputFile));
  prepareOutputFile(outputFile, input.force);

  const codeInventoryDir = input.codeInventoryDir
    ? path.resolve(input.codeInventoryDir)
    : resolveLatestCodeInventoryDir();

  if (!existsSync(codeInventoryDir)) {
    throw new CliError(
      `Discovery-model directory does not exist: ${codeInventoryDir}`,
      ExitCode.ARGV,
    );
  }

  if (!statSync(codeInventoryDir).isDirectory()) {
    throw new CliError(
      `Discovery-model path is not a directory: ${codeInventoryDir}`,
      ExitCode.ARGV,
    );
  }

  if (!existsSync(path.join(codeInventoryDir, "manifest.json"))) {
    throw new CliError(
      `Discovery-model manifest not found in: ${codeInventoryDir}`,
      ExitCode.ARGV,
    );
  }

  return {
    outputFile,
    codeInventoryDir,
    force: input.force,
    noDecorate: input.noDecorate,
    modelName: path.basename(outputFile, ".archimate"),
    modelId: ArchiModelStore.computeModelId(outputFile),
  };
}

function ensureArchimateExtension(outputFile: string): string {
  if (outputFile.toLowerCase().endsWith(".archimate")) {
    return outputFile;
  }
  return `${outputFile}.archimate`;
}

function prepareOutputFile(outputFile: string, force: boolean): void {
  if (!existsSync(outputFile)) {
    return;
  }

  if (!statSync(outputFile).isFile()) {
    throw new CliError(`Output path is not a file: ${outputFile}`, ExitCode.ARGV);
  }

  if (!force) {
    throw new CliError(
      `Output file already exists: ${outputFile}. Use --force to overwrite`,
      ExitCode.RUNTIME,
    );
  }
}
