import {
  BUILTIN_PROCESSOR_GROUPS,
  type BuiltInProcessorGroupId,
  isBuiltInProcessorGroupId,
} from "../../cli/processor-groups.js";
import type { ProcessorId } from "./processor.js";

export interface ParsedCoordinate {
  readonly groupId: string;
  readonly artifactId: string;
}

export function formatCoordinate(id: ProcessorId): string {
  return `${id.groupId}.${id.artifactId}`;
}

export function parseCoordinate(coordinate: string): ParsedCoordinate {
  const lastDot = coordinate.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === coordinate.length - 1) {
    throw new Error(`Invalid processor coordinate: "${coordinate}"`);
  }

  return {
    groupId: coordinate.slice(0, lastDot),
    artifactId: coordinate.slice(lastDot + 1),
  };
}

export function isWildcardPattern(pattern: string): boolean {
  return pattern.endsWith(".*");
}

export function validateFilterPattern(pattern: string): void {
  if (pattern.length === 0) {
    throw new Error("Processor filter pattern must not be empty");
  }

  if (pattern.includes("*") && !pattern.endsWith(".*")) {
    throw new Error(`Invalid processor filter pattern: "${pattern}"`);
  }

  if (pattern.endsWith(".*") && pattern.length === 2) {
    throw new Error(`Invalid processor filter pattern: "${pattern}"`);
  }

  if (!pattern.endsWith(".*")) {
    parseCoordinate(pattern);
  }
}

export function validateGroupPattern(pattern: string): void {
  if (pattern.length === 0) {
    throw new Error("Processor group pattern must not be empty");
  }

  if (pattern.includes("*") && !pattern.endsWith(".*")) {
    throw new Error(`Invalid processor group pattern: "${pattern}"`);
  }

  if (pattern.endsWith(".*") && pattern.length === 2) {
    throw new Error(`Invalid processor group pattern: "${pattern}"`);
  }
}

export function matchesGroupPattern(groupId: string, pattern: string): boolean {
  if (isWildcardPattern(pattern)) {
    const prefix = pattern.slice(0, -2);
    return groupId === prefix || groupId.startsWith(`${prefix}.`);
  }

  return groupId === pattern;
}

export function resolveBuiltInGroupId(groupId: string): BuiltInProcessorGroupId {
  if (isBuiltInProcessorGroupId(groupId)) {
    return groupId;
  }

  for (const builtIn of BUILTIN_PROCESSOR_GROUPS) {
    if (groupId.startsWith(`${builtIn}.`)) {
      return builtIn;
    }
  }

  throw new Error(`Processor groupId has no built-in prefix: "${groupId}"`);
}

export function isUnderBuiltInGroup(groupId: string, builtInGroupId: BuiltInProcessorGroupId): boolean {
  return groupId === builtInGroupId || groupId.startsWith(`${builtInGroupId}.`);
}

export function isValidProcessorGroupId(groupId: string): boolean {
  try {
    resolveBuiltInGroupId(groupId);
    return true;
  } catch {
    return false;
  }
}

export function matchesPattern(id: ProcessorId, pattern: string): boolean {
  if (isWildcardPattern(pattern)) {
    const prefix = pattern.slice(0, -2);
    return id.groupId === prefix || id.groupId.startsWith(`${prefix}.`);
  }

  return formatCoordinate(id) === pattern;
}
