import type { ProcessorId } from "./processor-id.js";

/**
 * Contract for a processor implementation.
 *
 * Processors that emit discovery-model entities or links must follow create-only
 * semantics: only new records (create-intents), no updates to existing records.
 * After acceptance into the run entity store, records are immutable for the run.
 * Duplicate `id` on create is a runtime error. See ADR-26082702.
 */
export interface IProcessor<TInput, TOutput> {
  readonly id: ProcessorId;
  readonly version: string;
  process(input: TInput): TOutput | Promise<TOutput>;
}
