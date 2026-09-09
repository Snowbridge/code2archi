import type { ArchiCreateIntents } from "../../archimate-model/archi-create-intents.js";
import type { ArchiModelSnapshot } from "../../archimate-model/archi-model-store.js";
import type { CreateIntents } from "../../code-inventory/entities/create-intents.js";
import type { Repository } from "../../code-inventory/entities/repository.js";
import type { CodeInventorySnapshot } from "../../code-inventory/run-entity-store.js";
import type { StepProgressHandle } from "../cli-progress/types.js";
import type { ProcessorSupplementRef } from "./processor-supplements.js";
import { getLogger, logCalls, processorLoggerName, type Logger } from "../logging/index.js";

export type { ProcessorSupplementRef } from "./processor-supplements.js";

export interface ProcessorId {
  readonly groupId: string;
  readonly artifactId: string;
}

export function processorKey(id: ProcessorId): string {
  return `${id.groupId}/${id.artifactId}`;
}

export type ProcessorExecutionPolicy = "ALWAYS" | "ON_DEMAND";

export type ScanScopeInput = {
  readonly sourceDirs: readonly string[];
  readonly progress?: StepProgressHandle;
  readonly supplements?: readonly ProcessorSupplementRef[];
};
export type ScanScopeOutput = readonly Repository[];

export type ScanAppInput = CodeInventorySnapshot & {
  readonly progress?: StepProgressHandle;
  readonly supplements?: readonly ProcessorSupplementRef[];
};
export type ScanAppOutput = CreateIntents;

export interface GenerateOptions {
  readonly decorate: boolean;
}

export interface GenerateProcessorInput {
  readonly discovery: CodeInventorySnapshot;
  readonly archi: ArchiModelSnapshot;
  readonly options: GenerateOptions;
  readonly supplements?: readonly ProcessorSupplementRef[];
}

export type GenerateProcessorOutput = ArchiCreateIntents;

/**
 * Base class for processor implementations.
 *
 * Processors that emit code-inventory entities or links must follow create-only
 * semantics: only new records (create-intents), no updates to existing records.
 * After acceptance into the run entity store, records are immutable for the run.
 * Duplicate `id` on create is a runtime error. See ADR-26082702 and ADR-26083001.
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
