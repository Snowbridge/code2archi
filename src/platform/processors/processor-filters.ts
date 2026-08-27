import type { ProcessorGroupId } from "../../cli/processor-groups.js";

export interface ProcessorFilters {
  readonly withNone: readonly ProcessorGroupId[];
  readonly without: Readonly<Partial<Record<ProcessorGroupId, readonly string[]>>>;
  readonly withOnly: Readonly<Partial<Record<ProcessorGroupId, readonly string[]>>>;
}
