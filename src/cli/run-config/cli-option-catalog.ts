import { globalOptions } from "../global-options.js";
import { scanCommandCacheOptions } from "../scan-cache-options.js";
import type { RunConfigCommandName } from "./run-config-types.js";

export const RUN_CONFIG_EXCLUDED_KEYS = new Set([
  "version",
  "help",
  "config",
  "debug",
]);

export const PROCESSOR_FILTER_KEYS = new Set(["with", "without", "with-only"]);

const GLOBAL_OPTION_KEYS = new Set(
  Object.keys(globalOptions).filter((key) => !RUN_CONFIG_EXCLUDED_KEYS.has(key)),
);

export const SUPPLEMENT_CONFIG_KEY = "supplement";

const COMMAND_ALIASES: Record<string, RunConfigCommandName> = {
  scan: "scan",
  generate: "generate",
  list: "list",
  "list-processors": "list",
  processors: "list",
};

const COMMAND_POSITIONALS: Record<RunConfigCommandName, readonly string[]> = {
  scan: ["source-dir"],
  generate: ["output-file", "code-inventory"],
  list: ["group-pattern"],
};

const COMMAND_OPTION_KEYS: Record<RunConfigCommandName, readonly string[]> = {
  scan: ["output", "force", ...Object.keys(scanCommandCacheOptions)],
  generate: ["force", "no-decorate"],
  list: ["only-groups", "to-json"],
};

const OPTION_ALIASES: Record<string, string> = {
  V: "verbose",
  h: "help",
  v: "version",
  g: "only-groups",
  groups: "only-groups",
};

export function resolveCommandName(token: string | undefined): RunConfigCommandName | undefined {
  if (token === undefined) {
    return undefined;
  }
  return COMMAND_ALIASES[token];
}

export function listKnownTopLevelNodes(): readonly string[] {
  return ["root", "scan", "generate", "list"];
}

export function allowedKeysForNode(
  nodeName: string,
  command: RunConfigCommandName | undefined,
): Set<string> | undefined {
  if (nodeName === "root") {
    return GLOBAL_OPTION_KEYS;
  }

  if (command === undefined || nodeName !== command) {
    return undefined;
  }

  return new Set([
    ...GLOBAL_OPTION_KEYS,
    ...COMMAND_POSITIONALS[command],
    ...COMMAND_OPTION_KEYS[command],
  ]);
}

export function positionalKeysForCommand(command: RunConfigCommandName): readonly string[] {
  return COMMAND_POSITIONALS[command];
}

export function resolveCanonicalOptionKey(token: string): string | undefined {
  if (token.startsWith("--")) {
    const key = token.slice(2);
    if (key.includes("=")) {
      return key.split("=")[0];
    }
    return key;
  }

  if (token.startsWith("-") && token.length === 2) {
    return OPTION_ALIASES[token.slice(1)];
  }

  if (token.startsWith("-") && !token.startsWith("--")) {
    return OPTION_ALIASES[token.slice(1)];
  }

  return undefined;
}

export function isRunConfigExcludedKey(key: string): boolean {
  return RUN_CONFIG_EXCLUDED_KEYS.has(key);
}
