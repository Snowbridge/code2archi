import {
  PROCESSOR_GROUP_DEFS,
  type GlobalArgv,
  type ProcessorGroupId,
} from "../../cli/processor-groups.js";
import type { ProcessorId } from "./processor.js";
import { processorKey } from "./processor.js";
import type { AbstractProcessor } from "./processor.js";

export interface ProcessorFilters {
  readonly withNone: readonly ProcessorGroupId[];
  readonly without: Readonly<Partial<Record<ProcessorGroupId, readonly string[]>>>;
  readonly with: Readonly<Partial<Record<ProcessorGroupId, readonly string[]>>>;
  readonly withOnly: Readonly<Partial<Record<ProcessorGroupId, readonly string[]>>>;
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

export class ProcessorRegistry {
  private readonly processors = new Map<string, AbstractProcessor<unknown, unknown>>();
  private readonly groupOrder = new Map<ProcessorGroupId, string[]>();

  register<TInput, TOutput>(processor: AbstractProcessor<TInput, TOutput>): void {
    const key = processorKey(processor.id);
    if (this.processors.has(key)) {
      throw new Error(
        `Processor already registered: ${processor.id.groupId}/${processor.id.artifactId}`,
      );
    }

    this.processors.set(key, processor as AbstractProcessor<unknown, unknown>);

    const order = this.groupOrder.get(processor.id.groupId) ?? [];
    order.push(key);
    this.groupOrder.set(processor.id.groupId, order);
  }

  unregister(groupId: ProcessorGroupId, artifactId: string): void {
    const key = processorKey({ groupId, artifactId });
    if (!this.processors.delete(key)) {
      return;
    }

    const order = this.groupOrder.get(groupId);
    if (!order) {
      return;
    }

    this.groupOrder.set(
      groupId,
      order.filter((entry) => entry !== key),
    );
  }

  get<TInput, TOutput>(
    groupId: ProcessorGroupId,
    artifactId: string,
  ): AbstractProcessor<TInput, TOutput> | undefined {
    return this.processors.get(processorKey({ groupId, artifactId })) as
      | AbstractProcessor<TInput, TOutput>
      | undefined;
  }

  listByGroup<TInput, TOutput>(
    groupId: ProcessorGroupId,
  ): AbstractProcessor<TInput, TOutput>[] {
    const order = this.groupOrder.get(groupId) ?? [];
    return order
      .map((key) => this.processors.get(key))
      .filter((processor) => processor !== undefined) as AbstractProcessor<TInput, TOutput>[];
  }

  listFiltered<TInput, TOutput>(
    groupId: ProcessorGroupId,
    filters: ProcessorFilters,
  ): AbstractProcessor<TInput, TOutput>[] {
    if (filters.withNone.includes(groupId)) {
      return [];
    }

    const registered = this.listByGroup<TInput, TOutput>(groupId);
    const withOnly = filters.withOnly[groupId];
    if (withOnly && withOnly.length > 0) {
      const allowed = new Set(withOnly);
      return registered.filter((processor) => allowed.has(processor.id.artifactId));
    }

    const withRequested = filters.with[groupId];
    const without = filters.without[groupId];
    const denied = without ? new Set(without) : new Set<string>();
    const onDemandEnabled = withRequested ? new Set(withRequested) : new Set<string>();

    const selected: AbstractProcessor<TInput, TOutput>[] = [];
    const seen = new Set<string>();

    for (const processor of registered) {
      const artifactId = processor.id.artifactId;
      if (seen.has(artifactId)) {
        continue;
      }

      if (processor.executionPolicy === "ON_DEMAND") {
        if (onDemandEnabled.has(artifactId) && !denied.has(artifactId)) {
          selected.push(processor);
          seen.add(artifactId);
        }
        continue;
      }

      if (!denied.has(artifactId)) {
        selected.push(processor);
        seen.add(artifactId);
      }
    }

    return selected;
  }
}

export const processorRegistry = new ProcessorRegistry();
