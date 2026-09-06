import { CliError } from "../cli-error.js";

export const PROCESSOR_FILTER_NONE = "none";

export function normalizeProcessorFilterValue(
  value: unknown,
  optionLabel: string,
): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  const items = Array.isArray(value) ? value.map(String) : [String(value)];
  if (items.length === 0) {
    return [];
  }

  if (items.length === 1 && items[0] === PROCESSOR_FILTER_NONE) {
    return [];
  }

  if (items.some((item) => item === PROCESSOR_FILTER_NONE)) {
    throw new CliError(
      `Invalid ${optionLabel}: "${PROCESSOR_FILTER_NONE}" cannot be combined with other values`,
    );
  }

  return items;
}
