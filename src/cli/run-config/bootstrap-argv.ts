import path from "node:path";
import { CliError } from "../cli-error.js";
import {
  detectCommandName,
  detectExplicitCliKeys,
  readConfigFlagValue,
  shouldSkipRunConfigLoad,
} from "./detect-explicit-cli-keys.js";
import { resolveCommandName } from "./cli-option-catalog.js";
import { loadRunConfigFile } from "./load-run-config.js";
import { resolveRunConfigPath } from "./resolve-run-config-path.js";
import { runConfigToArgvParts } from "./run-config-to-argv.js";
import {
  EMPTY_RUN_CONFIG_RESOLUTION,
  type RunConfigCommandName,
  type RunConfigResolution,
} from "./run-config-types.js";

export interface BootstrapArgvResult {
  readonly argv: string[];
  readonly runConfig: RunConfigResolution;
}

function isOptionToken(token: string): boolean {
  return token.startsWith("-");
}

function mergeArgvWithConfigParts(
  argv: string[],
  optionTokens: readonly string[],
  positionalValues: readonly string[],
  command: RunConfigCommandName,
): string[] {
  const head = [argv[0]!, argv[1]!];
  const rest = argv.slice(2);

  if (optionTokens.length === 0 && positionalValues.length === 0) {
    return argv;
  }

  const commandIndex = rest.findIndex((token) => resolveCommandName(token) === command);
  if (commandIndex >= 0 && positionalValues.length > 0) {
    return [
      ...head,
      ...optionTokens,
      ...rest.slice(0, commandIndex + 1),
      ...positionalValues,
      ...rest.slice(commandIndex + 1),
    ];
  }

  if (commandIndex >= 0) {
    return [...head, ...optionTokens, ...rest];
  }

  if (positionalValues.length > 0) {
    return [...head, ...optionTokens, command, ...positionalValues, ...rest];
  }

  return [...head, ...optionTokens, ...rest];
}

export function bootstrapArgv(
  argv: string[],
  cwd: string = process.cwd(),
): BootstrapArgvResult {
  if (argv.length < 2) {
    return { argv, runConfig: EMPTY_RUN_CONFIG_RESOLUTION };
  }

  if (shouldSkipRunConfigLoad(argv)) {
    return { argv, runConfig: EMPTY_RUN_CONFIG_RESOLUTION };
  }

  let configFlagValue: string | undefined;
  try {
    configFlagValue = readConfigFlagValue(argv);
  } catch {
    throw new CliError("Missing value for --config");
  }

  const command = detectCommandName(argv);
  const configPath = resolveRunConfigPath({ cwd, configFlagValue });

  if (configPath === undefined) {
    return { argv, runConfig: EMPTY_RUN_CONFIG_RESOLUTION };
  }

  const resolution: RunConfigResolution = {
    path: path.resolve(configPath),
    name: path.basename(configPath),
    loaded: true,
  };

  if (command === undefined) {
    return { argv, runConfig: resolution };
  }

  const effective = loadRunConfigFile(configPath, command);
  const explicitKeys = detectExplicitCliKeys(argv);
  const { optionTokens, positionalValues } = runConfigToArgvParts(
    effective,
    command,
    explicitKeys,
  );
  const mergedArgv = mergeArgvWithConfigParts(argv, optionTokens, positionalValues, command);

  return {
    argv: mergedArgv,
    runConfig: resolution,
  };
}
