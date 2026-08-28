import { getLogger, logCalls, processorLoggerName } from "../logging/index.js";
import type { Logger } from "../logging/types.js";
import type { ProcessorId } from "./processor-id.js";

export type ProcessorExecutionPolicy = "ALWAYS" | "ON_DEMAND";

/**
 * Base class for processor implementations.
 *
 * Processors that emit discovery-model entities or links must follow create-only
 * semantics: only new records (create-intents), no updates to existing records.
 * After acceptance into the run entity store, records are immutable for the run.
 * Duplicate `id` on create is a runtime error. See ADR-26082702.
 */
export abstract class AbstractProcessor<TInput, TOutput> {
  abstract readonly id: ProcessorId;
  abstract readonly version: string;
  abstract readonly executionPolicy: ProcessorExecutionPolicy;
  /** One-line purpose summary; must be English (see platform/processors.md). */
  abstract readonly description: string;

  private tracedProcess?: (input: TInput) => TOutput | Promise<TOutput>;

  protected abstract doProcess(input: TInput): TOutput | Promise<TOutput>;

  protected get logger(): Logger {
    return getLogger(processorLoggerName(this.id));
  }

  logStart(): void {
    this.logger.info("processor start");
  }

  logCompleted(count: number): void {
    this.logger.info("processor completed", { count });
  }

  process(input: TInput): TOutput | Promise<TOutput> {
    if (!this.tracedProcess) {
      this.tracedProcess = logCalls(
        (value: TInput) => this.doProcess(value),
        processorLoggerName(this.id),
        "process",
      );
    }
    return this.tracedProcess(input);
  }
}
