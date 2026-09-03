import type { ArchiCreateIntents } from "../../archimate-model/archi-create-intents.js";
import type { ArchiModelSnapshot } from "../../archimate-model/archi-model-store.js";
import type { CreateIntents } from "../../discovery-model/entities/create-intents.js";
import type { Repository } from "../../discovery-model/entities/repository.js";
import type { DiscoveryModelSnapshot } from "../../discovery-model/run-entity-store.js";
import type { StepProgressHandle } from "../cli-progress/types.js";
import { getLogger, logCalls, processorLoggerName, type Logger } from "../logging/index.js";

export interface ProcessorId {
  readonly groupId: string;
  readonly artifactId: string;
}

export function processorKey(id: ProcessorId): string {
  return `${id.groupId}/${id.artifactId}`;
}

export type ProcessorExecutionPolicy = "ALWAYS" | "ON_DEMAND";

export type ScanScopeInput = readonly string[];
export type ScanScopeOutput = readonly Repository[];

export type ScanAppInput = DiscoveryModelSnapshot & {
  readonly progress?: StepProgressHandle;
};
export type ScanAppOutput = CreateIntents;

export interface GenerateOptions {
  readonly decorate: boolean;
}

export interface GenerateProcessorInput {
  readonly discovery: DiscoveryModelSnapshot;
  readonly archi: ArchiModelSnapshot;
  readonly options: GenerateOptions;
}

export type GenerateProcessorOutput = ArchiCreateIntents;

/**
 * Base class for processor implementations.
 *
 * Processors that emit discovery-model entities or links must follow create-only
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
