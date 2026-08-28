import {
  PROCESSOR_GROUP_DEFS,
  type GlobalArgv,
  type ProcessorGroupId,
} from "../../cli/processor-groups.js";
import type { ProcessorFilters } from "./processor-filters.js";

function asStringArray(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return [String(value)];
}

export function resolveProcessorFilters(argv: GlobalArgv): ProcessorFilters {
  const without: Partial<Record<ProcessorGroupId, string[]>> = {};
  const withRequested: Partial<Record<ProcessorGroupId, string[]>> = {};
  const withOnly: Partial<Record<ProcessorGroupId, string[]>> = {};

  for (const def of PROCESSOR_GROUP_DEFS) {
    const denied = asStringArray(argv[def.withoutArgvKey]);
    if (denied.length > 0) {
      without[def.groupId] = denied;
    }

    const enabled = asStringArray(argv[def.withArgvKey]);
    if (enabled.length > 0) {
      withRequested[def.groupId] = enabled;
    }

    const allowed = asStringArray(argv[def.withOnlyArgvKey]);
    if (allowed.length > 0) {
      withOnly[def.groupId] = allowed;
    }
  }

  return {
    withNone: asStringArray(argv.withNone) as ProcessorGroupId[],
    without,
    with: withRequested,
    withOnly,
  };
}
