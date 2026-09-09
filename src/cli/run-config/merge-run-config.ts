import type { RunConfigCommandName, RunConfigValues } from "./run-config-types.js";
import {
  allowedKeysForNode,
  isRunConfigExcludedKey,
  PROCESSOR_FILTER_KEYS,
} from "./cli-option-catalog.js";
import { listKnownTopLevelNodes } from "./cli-option-catalog.js";
import { normalizeProcessorFilterValue } from "./normalize-processor-filter-value.js";
import { SUPPLEMENT_CONFIG_KEY } from "./cli-option-catalog.js";
import { normalizeSupplementConfigValue } from "../../platform/processors/processor-supplements.js";

function filterOptionBag(
  raw: unknown,
  nodeName: string,
  command: RunConfigCommandName | undefined,
): RunConfigValues {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const allowed = allowedKeysForNode(nodeName, command);
  if (allowed === undefined) {
    return {};
  }

  const filtered: RunConfigValues = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isRunConfigExcludedKey(key) || !allowed.has(key)) {
      continue;
    }

    if (PROCESSOR_FILTER_KEYS.has(key)) {
      filtered[key] = normalizeProcessorFilterValue(value, `--${key}`);
      continue;
    }

    if (key === SUPPLEMENT_CONFIG_KEY) {
      filtered[key] = normalizeSupplementConfigValue(value);
      continue;
    }

    filtered[key] = value;
  }

  return filtered;
}

export function parseRunConfigDocument(
  document: unknown,
  command: RunConfigCommandName | undefined,
): { readonly root: RunConfigValues; readonly command: RunConfigValues } {
  if (document === null || typeof document !== "object" || Array.isArray(document)) {
    return { root: {}, command: {} };
  }

  const knownNodes = new Set(listKnownTopLevelNodes());
  const record = document as Record<string, unknown>;
  const root = filterOptionBag(record.root, "root", command);

  if (command === undefined) {
    return { root, command: {} };
  }

  const commandSection = knownNodes.has(command) ? record[command] : undefined;
  const commandValues = filterOptionBag(commandSection, command, command);
  return { root, command: commandValues };
}

export function mergeRunConfigSections(
  root: RunConfigValues,
  command: RunConfigValues,
): RunConfigValues {
  return { ...root, ...command };
}
