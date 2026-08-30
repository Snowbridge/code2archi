import type { BuiltInProcessorGroupId, GlobalArgv } from "../../cli/processor-groups.js";
import {
  isUnderBuiltInGroup,
  isValidProcessorGroupId,
  matchesPattern,
} from "./processor-coordinate.js";
import type { ProcessorId } from "./processor.js";
import { processorKey } from "./processor.js";
import type { AbstractProcessor } from "./processor.js";

export interface ProcessorFilters {
  readonly with: readonly string[];
  readonly without: readonly string[];
  readonly withOnly: readonly string[];
}

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
  return {
    with: asStringArray(argv.with),
    without: asStringArray(argv.without),
    withOnly: asStringArray(argv.withOnly),
  };
}

export function isProcessorSelected(
  processor: AbstractProcessor<unknown, unknown>,
  filters: ProcessorFilters,
): boolean {
  if (filters.withOnly.length > 0) {
    return filters.withOnly.some((pattern) => matchesPattern(processor.id, pattern));
  }

  if (filters.without.some((pattern) => matchesPattern(processor.id, pattern))) {
    return false;
  }

  if (processor.executionPolicy === "ON_DEMAND") {
    return filters.with.some((pattern) => matchesPattern(processor.id, pattern));
  }

  return true;
}

export class ProcessorRegistry {
  private readonly processors = new Map<string, AbstractProcessor<unknown, unknown>>();
  private readonly registrationOrder: string[] = [];

  register<TInput, TOutput>(processor: AbstractProcessor<TInput, TOutput>): void {
    if (!isValidProcessorGroupId(processor.id.groupId)) {
      throw new Error(
        `Invalid processor groupId "${processor.id.groupId}": must start with a built-in group prefix`,
      );
    }

    const key = processorKey(processor.id);
    if (this.processors.has(key)) {
      throw new Error(
        `Processor already registered: ${processor.id.groupId}/${processor.id.artifactId}`,
      );
    }

    this.processors.set(key, processor as AbstractProcessor<unknown, unknown>);
    this.registrationOrder.push(key);
  }

  unregister(groupId: string, artifactId: string): void {
    const key = processorKey({ groupId, artifactId });
    if (!this.processors.delete(key)) {
      return;
    }

    const index = this.registrationOrder.indexOf(key);
    if (index >= 0) {
      this.registrationOrder.splice(index, 1);
    }
  }

  get<TInput, TOutput>(
    groupId: string,
    artifactId: string,
  ): AbstractProcessor<TInput, TOutput> | undefined {
    return this.processors.get(processorKey({ groupId, artifactId })) as
      | AbstractProcessor<TInput, TOutput>
      | undefined;
  }

  hasCoordinate(groupId: string, artifactId: string): boolean {
    return this.processors.has(processorKey({ groupId, artifactId }));
  }

  listAll<TInput, TOutput>(): AbstractProcessor<TInput, TOutput>[] {
    return this.registrationOrder
      .map((key) => this.processors.get(key))
      .filter((processor) => processor !== undefined) as AbstractProcessor<TInput, TOutput>[];
  }

  listForBuiltInStep<TInput, TOutput>(
    builtInGroupId: BuiltInProcessorGroupId,
    filters: ProcessorFilters,
  ): AbstractProcessor<TInput, TOutput>[] {
    const selected: AbstractProcessor<TInput, TOutput>[] = [];
    const seen = new Set<string>();

    for (const key of this.registrationOrder) {
      const processor = this.processors.get(key);
      if (!processor) {
        continue;
      }

      if (!isUnderBuiltInGroup(processor.id.groupId, builtInGroupId)) {
        continue;
      }

      const artifactId = processor.id.artifactId;
      if (seen.has(artifactId)) {
        continue;
      }

      if (!isProcessorSelected(processor, filters)) {
        continue;
      }

      selected.push(processor as AbstractProcessor<TInput, TOutput>);
      seen.add(artifactId);
    }

    return selected;
  }
}

export const processorRegistry = new ProcessorRegistry();
