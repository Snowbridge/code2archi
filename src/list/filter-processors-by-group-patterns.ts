import type { AbstractProcessor } from "../platform/processors/processor.js";
import { matchesGroupPattern } from "../platform/processors/processor-coordinate.js";
import { processorRegistry } from "../platform/processors/processor-registry.js";

function compareProcessors(
  left: AbstractProcessor<unknown, unknown>,
  right: AbstractProcessor<unknown, unknown>,
): number {
  const groupCompare = left.id.groupId.localeCompare(right.id.groupId);
  if (groupCompare !== 0) {
    return groupCompare;
  }

  return left.id.artifactId.localeCompare(right.id.artifactId);
}

function matchesAnyGroupPattern(groupId: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesGroupPattern(groupId, pattern));
}

export function filterProcessorsByGroupPatterns(
  patterns: readonly string[],
): AbstractProcessor<unknown, unknown>[] {
  const all = processorRegistry.listAll();

  if (patterns.length === 0) {
    return [...all].sort(compareProcessors);
  }

  return all
    .filter((processor) => matchesAnyGroupPattern(processor.id.groupId, patterns))
    .sort(compareProcessors);
}

export function listDistinctGroupIds(processors: readonly AbstractProcessor<unknown, unknown>[]): string[] {
  const groupIds = new Set<string>();
  for (const processor of processors) {
    groupIds.add(processor.id.groupId);
  }

  return [...groupIds].sort((left, right) => left.localeCompare(right));
}
