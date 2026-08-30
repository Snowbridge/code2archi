import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { CliError } from "../cli/cli-error.js";
import { ExitCode } from "../cli/exit-codes.js";
import { ArchiModelStore } from "../archimate-model/archi-model-store.js";
import { resolveLatestDiscoveryModelDir } from "./resolve-discovery-model-dir.js";

export interface GenerateArgs {
  outputFile: string;
  discoveryModelDir: string;
  force: boolean;
  modelName: string;
  modelId: string;
}

export interface ValidateGenerateArgsInput {
  outputFile: string;
  discoveryModelDir?: string;
  force: boolean;
}

export function validateGenerateArgs(input: ValidateGenerateArgsInput): GenerateArgs {
  if (!input.outputFile) {
    throw new CliError("Output file is required", ExitCode.ARGV);
  }

  const outputFile = ensureArchimateExtension(path.resolve(input.outputFile));
  prepareOutputFile(outputFile, input.force);

  const discoveryModelDir = input.discoveryModelDir
    ? path.resolve(input.discoveryModelDir)
    : resolveLatestDiscoveryModelDir();

  if (!existsSync(discoveryModelDir)) {
    throw new CliError(
      `Discovery-model directory does not exist: ${discoveryModelDir}`,
      ExitCode.ARGV,
    );
  }

  if (!statSync(discoveryModelDir).isDirectory()) {
    throw new CliError(
      `Discovery-model path is not a directory: ${discoveryModelDir}`,
      ExitCode.ARGV,
    );
  }

  if (!existsSync(path.join(discoveryModelDir, "manifest.json"))) {
    throw new CliError(
      `Discovery-model manifest not found in: ${discoveryModelDir}`,
      ExitCode.ARGV,
    );
  }

  return {
    outputFile,
    discoveryModelDir,
    force: input.force,
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
