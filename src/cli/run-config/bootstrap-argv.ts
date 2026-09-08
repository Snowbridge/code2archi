import path from "node:path";
import { CliError } from "../cli-error.js";
import {
  detectCommandName,
  detectExplicitCliKeys,
  readConfigFlagValue,
  shouldSkipRunConfigLoad,
} from "./detect-explicit-cli-keys.js";
import { positionalKeysForCommand, resolveCommandName } from "./cli-option-catalog.js";
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

function normalizeBootstrapArgv(argv: string[]): string[] {
  if (
    argv.length >= 3 &&
    resolveCommandName(argv[0]) === undefined &&
    resolveCommandName(argv[2]) !== undefined
  ) {
    return argv.slice(2);
  }

  return argv;
}

function splitLeadingCommandPositionals(
  tokens: readonly string[],
  command: RunConfigCommandName,
): { readonly cliPositionals: string[]; readonly cliOptions: string[] } {
  const positionalKeys = positionalKeysForCommand(command);
  const cliPositionals: string[] = [];
  let index = 0;

  if (command === "scan") {
    while (index < tokens.length && !tokens[index]!.startsWith("-")) {
      cliPositionals.push(tokens[index]!);
      index += 1;
    }

    return { cliPositionals, cliOptions: [...tokens.slice(index)] };
  }

  while (
    index < tokens.length &&
    !tokens[index]!.startsWith("-") &&
    cliPositionals.length < positionalKeys.length
  ) {
    cliPositionals.push(tokens[index]!);
    index += 1;
  }

  return { cliPositionals, cliOptions: [...tokens.slice(index)] };
}

function mergeArgvWithConfigParts(
  userArgs: string[],
  optionTokens: readonly string[],
  positionalValues: readonly string[],
  command: RunConfigCommandName,
): string[] {
  if (optionTokens.length === 0 && positionalValues.length === 0) {
    return userArgs;
  }

  const commandIndex = userArgs.findIndex((token) => resolveCommandName(token) === command);

  if (commandIndex < 0) {
    if (positionalValues.length > 0) {
      return [command, ...positionalValues, ...optionTokens, ...userArgs];
    }

    return [command, ...optionTokens, ...userArgs];
  }

  const beforeCommand = userArgs.slice(0, commandIndex);
  const afterCommand = userArgs.slice(commandIndex + 1);
  const { cliPositionals, cliOptions } = splitLeadingCommandPositionals(afterCommand, command);
  const mergedPositionals = positionalValues.length > 0 ? positionalValues : cliPositionals;

  return [
    ...beforeCommand,
    command,
    ...mergedPositionals,
    ...optionTokens,
    ...cliOptions,
  ];
}

export function bootstrapArgv(
  argv: string[],
  cwd: string = process.cwd(),
): BootstrapArgvResult {
  const userArgs = normalizeBootstrapArgv(argv);

  if (userArgs.length === 0) {
    return { argv, runConfig: EMPTY_RUN_CONFIG_RESOLUTION };
  }

  if (shouldSkipRunConfigLoad(userArgs)) {
    return { argv: userArgs, runConfig: EMPTY_RUN_CONFIG_RESOLUTION };
  }

  let configFlagValue: string | undefined;
  try {
    configFlagValue = readConfigFlagValue(userArgs);
  } catch {
    throw new CliError("Missing value for --config");
  }

  const command = detectCommandName(userArgs);
  const configPath = resolveRunConfigPath({ cwd, configFlagValue });

  if (configPath === undefined) {
    return { argv: userArgs, runConfig: EMPTY_RUN_CONFIG_RESOLUTION };
  }

  const resolution: RunConfigResolution = {
    path: path.resolve(configPath),
    name: path.basename(configPath),
    loaded: true,
  };

  if (command === undefined) {
    return { argv: userArgs, runConfig: resolution };
  }

  const effective = loadRunConfigFile(configPath, command);
  const explicitKeys = detectExplicitCliKeys(userArgs);
  const { optionTokens, positionalValues } = runConfigToArgvParts(
    effective,
    command,
    explicitKeys,
  );
  const mergedArgv = mergeArgvWithConfigParts(
    userArgs,
    optionTokens,
    positionalValues,
    command,
  );

  return {
    argv: mergedArgv,
    runConfig: resolution,
  };
}
