import type { ProcessorGroupId } from "../../cli/processor-groups.js";
import type { ProcessorFilters } from "./processor-filters.js";
import type { ProcessorId } from "./processor-id.js";
import { processorKey } from "./processor-id.js";
import type { IProcessor } from "./processor.js";

export class ProcessorRegistry {
  private readonly processors = new Map<string, IProcessor<unknown, unknown>>();
  private readonly groupOrder = new Map<ProcessorGroupId, string[]>();

  register<TInput, TOutput>(processor: IProcessor<TInput, TOutput>): void {
    const key = processorKey(processor.id);
    if (this.processors.has(key)) {
      throw new Error(
        `Processor already registered: ${processor.id.groupId}/${processor.id.artifactId}`,
      );
    }

    this.processors.set(key, processor as IProcessor<unknown, unknown>);

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
  ): IProcessor<TInput, TOutput> | undefined {
    return this.processors.get(processorKey({ groupId, artifactId })) as
      | IProcessor<TInput, TOutput>
      | undefined;
  }

  listByGroup<TInput, TOutput>(
    groupId: ProcessorGroupId,
  ): IProcessor<TInput, TOutput>[] {
    const order = this.groupOrder.get(groupId) ?? [];
    return order
      .map((key) => this.processors.get(key))
      .filter((processor): processor is IProcessor<TInput, TOutput> => processor !== undefined);
  }

  listFiltered<TInput, TOutput>(
    groupId: ProcessorGroupId,
    filters: ProcessorFilters,
  ): IProcessor<TInput, TOutput>[] {
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

    const selected: IProcessor<TInput, TOutput>[] = [];
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
