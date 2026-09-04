import path from "node:path";
import { performance } from "node:perf_hooks";
import type { CreateIntents } from "../../../discovery-model/entities/create-intents.js";
import type { DiscoveryModelSnapshot } from "../../../discovery-model/run-entity-store.js";
import type { Repository } from "../../../discovery-model/entities/repository.js";
import { processorRegistry } from "../../processors/processor-registry.js";
import type { ProcessorId, ScanAppInput, ScanScopeInput } from "../../processors/processor.js";
import { runProcessorWithMetrics } from "../../profiling/flow-metrics.js";
import { recordValue } from "../../profiling/index.js";
import { METRIC_WORKER_TASK_DURATION } from "../../profiling/metric-types.js";
import { GitWorkingCopy } from "../../../utils/git-working-copy.js";
import { RepositoryBuilder } from "../../../utils/repository-builder.js";
import {
  deserializeDiscoverySnapshot,
  filterSerializableDiscoverySnapshotToRepository,
} from "../snapshot-serialization.js";
import type {
  ScanProcessorTaskInput,
  ScanRepositoryBatchTaskInput,
  ScanRepositoryBatchTaskResult,
  ScanScopeUnitTaskInput,
} from "../task-inputs.js";
import { formatProcessorTaskKey } from "../task-inputs.js";
import { tryGetWorkerPhase } from "../worker-phase-context.js";
import { getOrBuildRepositorySnapshot } from "../worker-snapshot-cache.js";
import { createWorkerProgressHandle } from "../worker-runtime.js";
import type { StepProgressHandle } from "../../cli-progress/types.js";
import { WORKER_HANDLER_SCAN_SCOPE_UNIT } from "../worker-handler-id.js";

function resolveScanProcessorSnapshot(input: ScanProcessorTaskInput): ScanAppInput {
  const phase = tryGetWorkerPhase();
  if (phase && input.repositoryId) {
    return getOrBuildRepositorySnapshot(input.repositoryId);
  }

  if (input.repositoryId && input.snapshot) {
    const snapshotData = filterSerializableDiscoverySnapshotToRepository(
      input.snapshot,
      input.repositoryId,
      input.snapshotFilterScope ?? "rest",
    );
    return deserializeDiscoverySnapshot(snapshotData);
  }

  if (input.snapshot) {
    return deserializeDiscoverySnapshot(input.snapshot);
  }

  throw new Error("Scan processor task requires phase setup or inline snapshot");
}

function countCreateIntents(output: CreateIntents): number {
  return (
    (output.entities
      ? Object.values(output.entities).reduce((sum, records) => sum + (records?.length ?? 0), 0)
      : 0) +
    (output.links
      ? Object.values(output.links).reduce((sum, records) => sum + (records?.length ?? 0), 0)
      : 0)
  );
}

function withScanProgress(
  snapshot: DiscoveryModelSnapshot,
  progress?: StepProgressHandle,
): ScanAppInput {
  if (!progress) {
    return snapshot;
  }

  return new Proxy(snapshot, {
    get(target, prop, receiver) {
      if (prop === "progress") {
        return progress;
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function processScanProcessorOnSnapshot(
  processorId: ProcessorId,
  snapshot: DiscoveryModelSnapshot,
  progress?: StepProgressHandle,
): CreateIntents {
  const processor = processorRegistry.get(processorId.groupId, processorId.artifactId);
  if (!processor) {
    throw new Error(`Processor not found: ${processorId.groupId}/${processorId.artifactId}`);
  }

  const scanInput = withScanProgress(snapshot, progress);
  processor.logStart();
  const output = runProcessorWithMetrics(processorId, () =>
    processor.process(scanInput),
  ) as CreateIntents;
  if (output instanceof Promise) {
    throw new Error(
      `Processor ${processorId.groupId}/${processorId.artifactId} returned a Promise`,
    );
  }

  processor.logCompleted(countCreateIntents(output));
  return output;
}

export function runScanProcessorTask(input: ScanProcessorTaskInput): CreateIntents {
  const snapshot = resolveScanProcessorSnapshot(input);
  const progress = input.progressStepId
    ? createWorkerProgressHandle(input.progressStepId)
    : undefined;

  return processScanProcessorOnSnapshot(input.processor, snapshot, progress);
}

export function runScanRepositoryBatchTask(
  input: ScanRepositoryBatchTaskInput,
): ScanRepositoryBatchTaskResult {
  const snapshot = getOrBuildRepositorySnapshot(input.repositoryId);
  const progress = input.progressStepId
    ? createWorkerProgressHandle(input.progressStepId)
    : undefined;

  const outputs: Record<string, CreateIntents> = {};
  const errors: Record<string, { message: string; stack?: string }> = {};

  for (const processorId of input.processors) {
    const startedAt = performance.now();
    try {
      const output = processScanProcessorOnSnapshot(processorId, snapshot, progress);
      outputs[formatProcessorTaskKey(processorId)] = output;
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      if (input.continueOnError) {
        errors[formatProcessorTaskKey(processorId)] = {
          message: failure.message,
          stack: failure.stack,
        };
      } else {
        throw failure;
      }
    } finally {
      recordValue(METRIC_WORKER_TASK_DURATION, performance.now() - startedAt, [
        processorId.groupId,
        processorId.artifactId,
      ]);
    }
  }

  return Object.keys(errors).length > 0 ? { outputs, errors } : { outputs };
}

export function runScanScopeUnitTask(input: ScanScopeUnitTaskInput): readonly Repository[] {
  const progress = input.progressStepId
    ? createWorkerProgressHandle(input.progressStepId)
    : undefined;

  if (input.processor.artifactId === "git-repositories" && input.unit.kind === "repoRoot") {
    const url = GitWorkingCopy.resolveRemoteUrl(input.unit.path);
    const repository = RepositoryBuilder.buildFromRoot(
      input.sourceDirs,
      input.unit.path,
      url ?? "",
    );
    progress?.tick(1);
    return [repository];
  }

  if (input.processor.artifactId === "unversioned-folders" && input.unit.kind === "sourceDir") {
    const repository = RepositoryBuilder.buildFromRoot(
      input.sourceDirs,
      path.resolve(input.unit.path),
      "",
    );
    progress?.tick(1);
    return [repository];
  }

  const scopeInput: ScanScopeInput = {
    sourceDirs: input.sourceDirs,
    progress,
  };
  const processor = processorRegistry.get(input.processor.groupId, input.processor.artifactId);
  if (!processor) {
    throw new Error(
      `Processor not found: ${input.processor.groupId}/${input.processor.artifactId}`,
    );
  }

  const output = runProcessorWithMetrics(input.processor, () =>
    processor.process(scopeInput),
  ) as readonly Repository[];
  if (output instanceof Promise) {
    throw new Error(
      `Processor ${input.processor.groupId}/${input.processor.artifactId} returned a Promise`,
    );
  }
  return output;
}

export function isSupportedScanScopeUnitProcessor(artifactId: string): boolean {
  return artifactId === "git-repositories" || artifactId === "unversioned-folders";
}

export { WORKER_HANDLER_SCAN_SCOPE_UNIT };
