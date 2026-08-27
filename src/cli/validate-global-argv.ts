import { CliError } from "./cli-error.js";
import {
  PROCESSOR_GROUP_DEFS,
  isProcessorGroupId,
  type GlobalArgv,
} from "./processor-groups.js";

function asStringArray(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return [String(value)];
}

export function validateGlobalArgv(
  argv: Record<string, unknown>,
): asserts argv is GlobalArgv & Record<string, unknown> {
  const withNone = asStringArray(argv.withNone);

  for (const groupId of withNone) {
    if (!isProcessorGroupId(groupId)) {
      throw new CliError(`Invalid --with-none groupId: "${groupId}"`);
    }
  }

  for (const def of PROCESSOR_GROUP_DEFS) {
    const without = asStringArray(argv[def.withoutArgvKey]);
    const withOnly = asStringArray(argv[def.withOnlyArgvKey]);
    const none = withNone.includes(def.groupId);

    if (none && withOnly.length > 0) {
      throw new CliError(
        `Conflicting processor filters for group "${def.groupId}": --with-none and --with-only-${def.groupId}`,
      );
    }

    if (withOnly.length > 0 && without.length > 0) {
      throw new CliError(
        `Conflicting processor filters for group "${def.groupId}": --with-only-${def.groupId} and --without-${def.groupId}`,
      );
    }

    if (none && without.length > 0) {
      throw new CliError(
        `Conflicting processor filters for group "${def.groupId}": --with-none and --without-${def.groupId}`,
      );
    }
  }
}
