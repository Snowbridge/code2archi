import { CliError } from "./cli-error.js";
import type { GlobalArgv } from "./processor-groups.js";
import { parseCoordinate, validateFilterPattern } from "../platform/processors/processor-coordinate.js";
import { processorRegistry } from "../platform/processors/processor-registry.js";

function asStringArray(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return [String(value)];
}

function collectExactCoordinates(patterns: readonly string[]): string[] {
  return patterns.filter((pattern) => !pattern.endsWith(".*"));
}

export function validateGlobalArgv(
  argv: Record<string, unknown>,
): asserts argv is GlobalArgv & Record<string, unknown> {
  const withRequested = asStringArray(argv.with);
  const without = asStringArray(argv.without);
  const withOnly = asStringArray(argv.withOnly);

  for (const pattern of [...withRequested, ...without, ...withOnly]) {
    try {
      validateFilterPattern(pattern);
    } catch (error) {
      throw new CliError(
        error instanceof Error ? error.message : `Invalid processor filter pattern: "${pattern}"`,
      );
    }
  }

  if (withOnly.length > 0 && withRequested.length > 0) {
    throw new CliError(
      "Conflicting processor filters: --with-only and --with cannot be used together",
    );
  }

  const denied = new Set(without);
  for (const coordinate of collectExactCoordinates(withRequested)) {
    if (denied.has(coordinate)) {
      throw new CliError(
        `Conflicting processor filters: --with and --without both list "${coordinate}"`,
      );
    }
  }

  for (const coordinate of collectExactCoordinates(withOnly)) {
    if (denied.has(coordinate)) {
      throw new CliError(
        `Conflicting processor filters: --with-only and --without both list "${coordinate}"`,
      );
    }
  }

  for (const coordinate of [
    ...collectExactCoordinates(withRequested),
    ...collectExactCoordinates(without),
    ...collectExactCoordinates(withOnly),
  ]) {
    const { groupId, artifactId } = parseCoordinate(coordinate);
    if (!processorRegistry.hasCoordinate(groupId, artifactId)) {
      throw new CliError(`Unknown processor coordinate: "${coordinate}"`);
    }
  }
}
