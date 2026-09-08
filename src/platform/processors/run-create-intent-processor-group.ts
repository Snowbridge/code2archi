import { SCAN_EXTRACT_GROUP_ID, type BuiltInProcessorGroupId } from "../../cli/processor-groups.js";
import type { StepProgressHandle } from "../cli-progress/types.js";
import type { CreateIntents } from "../../code-inventory/entities/create-intents.js";
import type { CodeInventorySnapshot, RunEntityStore } from "../../code-inventory/run-entity-store.js";
import type { MainThreadBridge } from "../parallelism/main-thread-bridge.js";
import { resetScanIoCache } from "../scan-io/index.js";
import {
  buildScanLinkTasks,
  buildScanRepositoryBatchTasks,
} from "../parallelism/task-planner.js";
import { serializeDiscoverySnapshot, type SnapshotRepositoryFilterScope } from "../parallelism/snapshot-serialization.js";
import type { WorkerPool } from "../parallelism/worker-pool.js";
import { runProcessorWithMetrics } from "../profiling/flow-metrics.js";
import type { ProcessorFilters } from "./processor-registry.js";
import { processorRegistry } from "./processor-registry.js";
import type { ScanAppInput } from "./processor.js";
import type { ProcessorId } from "./processor.js";
import { getLogger } from "../logging/index.js";
import {
  collectRepositoryBatchProcessorErrors,
  finalizePoolErrorsAfterMerge,
  mergeRepositoryBatchResults,
  mergeParallelCreateIntentResults,
  runScanProcessorPool,
  runScanRepositoryBatchPool,
} from "./parallel-group-runner.js";
import { isAssemblyExtractProcessor } from "./scan-extract-phases.js";

export interface ProcessorGroupParallelContext {
  readonly pool: WorkerPool;
  readonly bridge: MainThreadBridge;
  readonly continueOnError: boolean;
}

function countCreateIntents(output: CreateIntents): number {
  let count = 0;
  if (output.entities) {
    for (const entities of Object.values(output.entities)) {
      if (entities) {
        count += entities.length;
      }
    }
  }
  if (output.links) {
    for (const links of Object.values(output.links) as Array<
      readonly import("../../code-inventory/entities/create-intents.js").LinkCreateIntentRecord[] | undefined
    >) {
      if (links) {
        count += links.length;
      }
    }
  }
  return count;
}

function runSequentialCreateIntentGroup(
  builtInGroupId: BuiltInProcessorGroupId,
  filters: ProcessorFilters,
  store: RunEntityStore,
  progress?: StepProgressHandle,
): void {
  const processors = processorRegistry.listForBuiltInStep<ScanAppInput, CreateIntents>(
    builtInGroupId,
    filters,
  );

  const passProgress = builtInGroupId === SCAN_EXTRACT_GROUP_ID && progress !== undefined;

  if (builtInGroupId === SCAN_EXTRACT_GROUP_ID) {
    resetScanIoCache();
  }

  for (const processor of processors) {
    processor.logStart();

    const snapshot = store.snapshot();
    const input: ScanAppInput = passProgress
      ? new Proxy(snapshot, {
          get(target, prop, receiver) {
            if (prop === "progress") {
              return progress;
            }
            const value = Reflect.get(target, prop, receiver);
            return typeof value === "function" ? value.bind(target) : value;
          },
        })
      : snapshot;

    const output = runProcessorWithMetrics(processor.id, () => processor.process(input));
    if (output instanceof Promise) {
      throw new Error(
        `Processor ${processor.id.groupId}/${processor.id.artifactId} returned a Promise; sync execution expected`,
      );
    }

    const count = countCreateIntents(output);
    if (!output.entities && !output.links) {
      processor.logCompleted(0);
      if (builtInGroupId !== SCAN_EXTRACT_GROUP_ID) {
        progress?.tick(1);
      }
      continue;
    }

    store.addCreateIntents(builtInGroupId, processor.id, output);
    processor.logCompleted(count);
    if (builtInGroupId !== SCAN_EXTRACT_GROUP_ID) {
      progress?.tick(1);
    }
  }
}

interface ScanExtractParallelPhaseConfig {
  readonly phaseId: string;
  readonly snapshotFilterScope: SnapshotRepositoryFilterScope;
}

async function runParallelScanSourcePhase(
  processors: readonly ReturnType<
    typeof processorRegistry.listForBuiltInStep<ScanAppInput, CreateIntents>
  >[number][],
  store: RunEntityStore,
  parallel: ProcessorGroupParallelContext,
  progressStepId: string,
  phase: ScanExtractParallelPhaseConfig,
): Promise<void> {
  if (processors.length === 0) {
    return;
  }

  const snapshot = store.snapshot();
  const serialized = serializeDiscoverySnapshot(snapshot);
  await parallel.pool.setupPhase(
    {
      phaseId: phase.phaseId,
      snapshot: serialized,
      snapshotFilterScope: phase.snapshotFilterScope,
    },
    parallel.bridge,
  );

  const tasks = buildScanRepositoryBatchTasks(
    processors,
    snapshot,
    progressStepId,
    phase.snapshotFilterScope,
    parallel.continueOnError,
  );
  if (tasks.length === 0) {
    return;
  }

  const { results } = await runScanRepositoryBatchPool(
    parallel.pool,
    parallel.bridge,
    tasks,
    parallel.continueOnError,
    SCAN_EXTRACT_GROUP_ID,
  );

  mergeRepositoryBatchResults(SCAN_EXTRACT_GROUP_ID, store, results);
  const processorErrors = collectRepositoryBatchProcessorErrors(results);
  if (processorErrors.size > 0) {
    const logger = getLogger("platform.parallelism");
    for (const [taskId, error] of processorErrors) {
      logger.info("processor failed in batch", {
        pool: SCAN_EXTRACT_GROUP_ID,
        taskId,
        message: error.message,
      });
    }
    if (!parallel.continueOnError) {
      throw [...processorErrors.values()][0];
    }
    throw new AggregateError(
      [...processorErrors.values()],
      `${SCAN_EXTRACT_GROUP_ID}: ${processorErrors.size} processor(s) failed in batch`,
    );
  }
}

async function runParallelScanSourceGroup(
  processors: ReturnType<typeof processorRegistry.listForBuiltInStep<ScanAppInput, CreateIntents>>,
  store: RunEntityStore,
  parallel: ProcessorGroupParallelContext,
  progressStepId: string,
): Promise<void> {
  const assemblyProcessors = processors.filter((processor) =>
    isAssemblyExtractProcessor(processor.id.groupId),
  );
  const moduleSourceProcessors = processors.filter(
    (processor) => !isAssemblyExtractProcessor(processor.id.groupId),
  );

  await runParallelScanSourcePhase(assemblyProcessors, store, parallel, progressStepId, {
    phaseId: "scan.extract.assembly",
    snapshotFilterScope: "assembly",
  });

  await runParallelScanSourcePhase(moduleSourceProcessors, store, parallel, progressStepId, {
    phaseId: "scan.extract.module-source",
    snapshotFilterScope: "module-source",
  });
}

async function runParallelScanLinkGroup(
  processors: ReturnType<typeof processorRegistry.listForBuiltInStep<ScanAppInput, CreateIntents>>,
  snapshot: CodeInventorySnapshot,
  store: RunEntityStore,
  parallel: ProcessorGroupParallelContext,
  progress?: StepProgressHandle,
): Promise<void> {
  const tasks = buildScanLinkTasks(processors, snapshot);
  const processorByTaskId = new Map<string, ProcessorId>(
    tasks.map((task) => [task.taskId, task.input.processor]),
  );

  const { results, errors } = await runScanProcessorPool(
    parallel.pool,
    parallel.bridge,
    tasks,
    parallel.continueOnError,
    "scan.transform",
  );

  mergeParallelCreateIntentResults("scan.transform", store, processorByTaskId, results);
  finalizePoolErrorsAfterMerge("scan.transform", errors, parallel.continueOnError);

  for (const processor of processors) {
    progress?.tick(1);
  }
}

export async function runCreateIntentProcessorGroup(
  builtInGroupId: BuiltInProcessorGroupId,
  filters: ProcessorFilters,
  store: RunEntityStore,
  progress?: StepProgressHandle,
  parallel?: ProcessorGroupParallelContext,
  progressStepId?: string,
): Promise<void> {
  const logger = getLogger(`scan.${builtInGroupId}`);
  logger.info("group start", { groupId: builtInGroupId });

  const processors = processorRegistry.listForBuiltInStep<ScanAppInput, CreateIntents>(
    builtInGroupId,
    filters,
  );

  if (processors.length === 0) {
    logger.info("group completed", { groupId: builtInGroupId });
    return;
  }

  if (!parallel) {
    runSequentialCreateIntentGroup(builtInGroupId, filters, store, progress);
    logger.info("group completed", { groupId: builtInGroupId });
    return;
  }

  const snapshot = store.snapshot();

  if (builtInGroupId === SCAN_EXTRACT_GROUP_ID) {
    await runParallelScanSourceGroup(processors, store, parallel, progressStepId ?? "2");
  } else if (builtInGroupId === "scan.transform") {
    await runParallelScanLinkGroup(processors, snapshot, store, parallel, progress);
  } else {
    runSequentialCreateIntentGroup(builtInGroupId, filters, store, progress);
  }

  logger.info("group completed", { groupId: builtInGroupId });
}
