import { CliError } from "../cli/cli-error.js";
import { validateGroupPattern } from "../platform/processors/processor-coordinate.js";

export interface ListArgs {
  readonly groupPatterns: readonly string[];
  readonly onlyGroups: boolean;
  readonly toJson: boolean;
}

export function validateListArgs(argv: {
  groupPatterns: string[];
  onlyGroups: boolean;
  toJson: boolean;
}): ListArgs {
  for (const pattern of argv.groupPatterns) {
    try {
      validateGroupPattern(pattern);
    } catch (error) {
      throw new CliError(
        error instanceof Error ? error.message : `Invalid processor group pattern: "${pattern}"`,
      );
    }
  }

  return {
    groupPatterns: argv.groupPatterns,
    onlyGroups: argv.onlyGroups,
    toJson: argv.toJson,
  };
}
