import {
  positionalKeysForCommand,
  PROCESSOR_FILTER_KEYS,
} from "./cli-option-catalog.js";
import type { RunConfigCommandName, RunConfigValues } from "./run-config-types.js";

export interface RunConfigArgvParts {
  readonly optionTokens: string[];
  readonly positionalValues: string[];
}

function appendOptionTokens(tokens: string[], key: string, value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value === "boolean") {
    if (value) {
      tokens.push(`--${key}`);
    } else {
      tokens.push(`--${key}`, "false");
    }
    return;
  }

  if (typeof value === "number") {
    tokens.push(`--${key}`, String(value));
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return;
    }

    for (const item of value) {
      tokens.push(`--${key}`, String(item));
    }
    return;
  }

  tokens.push(`--${key}`, String(value));
}

export function runConfigToArgvParts(
  effective: RunConfigValues,
  command: RunConfigCommandName,
  explicitKeys: ReadonlySet<string>,
): RunConfigArgvParts {
  const optionTokens: string[] = [];
  const positionalKeys = positionalKeysForCommand(command);
  const positionalValues: string[] = [];

  if (!positionalKeys.some((key) => explicitKeys.has(key))) {
    for (const positionalKey of positionalKeys) {
      const value = effective[positionalKey];
      if (value === undefined || value === null) {
        continue;
      }

      if (Array.isArray(value)) {
        positionalValues.push(...value.map(String));
      } else {
        positionalValues.push(String(value));
      }
    }
  }

  for (const [key, value] of Object.entries(effective)) {
    if (positionalKeys.includes(key) || explicitKeys.has(key)) {
      continue;
    }

    if (PROCESSOR_FILTER_KEYS.has(key) && Array.isArray(value) && value.length === 0) {
      continue;
    }

    appendOptionTokens(optionTokens, key, value);
  }

  return { optionTokens, positionalValues };
}

/** @deprecated Use runConfigToArgvParts via bootstrapArgv. */
export function runConfigToArgv(
  effective: RunConfigValues,
  command: RunConfigCommandName,
  explicitKeys: ReadonlySet<string>,
): string[] {
  const parts = runConfigToArgvParts(effective, command, explicitKeys);
  if (parts.positionalValues.length === 0) {
    return parts.optionTokens;
  }
  return [command, ...parts.positionalValues, ...parts.optionTokens];
}
