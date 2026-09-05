import { SCAN_EXTRACT_GROUP_ID, type BuiltInProcessorGroupId } from "../../cli/processor-groups.js";
import type { StepProgressHandle } from "../cli-progress/types.js";
import type { CreateIntents } from "../../discovery-model/entities/create-intents.js";
import type { DiscoveryModelSnapshot, RunEntityStore } from "../../discovery-model/run-entity-store.js";
import type { MainThreadBridge } from "../parallelism/main-thread-bridge.js";
import { resetScanIoCache } from "../scan-io/index.js";
import {
  buildScanLinkTasks,
  buildScanRepositoryBatchTasks,
} from "../parallelism/task-planner.js";
import { partitionScanSourceProcessors } from "../parallelism/scan-extract-phases.js";
import { serializeDiscoverySnapshot } from "../parallelism/snapshot-serialization.js";
import type { SnapshotRepositoryFilterScope } from "../parallelism/snapshot-serialization.js";
import type { WorkerPool } from "../parallelism/worker-pool.js";
import { runProcessorWithMetrics } from "../profiling/flow-metrics.js";
import type { ProcessorFilters } from "./processor-registry.js";
import { processorRegistry } from "./processor-registry.js";
import type { ScanAppInput } from "./processor.js";
import type { ProcessorId } from "./processor.js";
import { getLogger } from "../logging/index.js";
import {
  collectRepositoryBatchProcessorErrors,
  mergeRepositoryBatchResults,
  mergeParallelCreateIntentResults,
  runScanProcessorPool,
  runScanRepositoryBatchPool,
} from "./parallel-group-runner.js";

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
    for (const links of Object.values(output.links)) {
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

async function runParallelScanSourcePhase(
  processors: readonly ReturnType<
    typeof processorRegistry.listForBuiltInStep<ScanAppInput, CreateIntents>
  >[number][],
  store: RunEntityStore,
  parallel: ProcessorGroupParallelContext,
  progressStepId: string,
  snapshotFilterScope: SnapshotRepositoryFilterScope,
): Promise<void> {
  if (processors.length === 0) {
    return;
  }

  const snapshot = store.snapshot();
  const serialized = serializeDiscoverySnapshot(snapshot);
  const phaseId = `scan.extract.${snapshotFilterScope}`;
  await parallel.pool.setupPhase(
    {
      phaseId,
      snapshot: serialized,
      snapshotFilterScope,
    },
    parallel.bridge,
  );

  const tasks = buildScanRepositoryBatchTasks(
    processors,
    snapshot,
    progressStepId,
    snapshotFilterScope,
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
    if (parallel.continueOnError) {
      throw new AggregateError(
        [...processorErrors.values()],
        `${SCAN_EXTRACT_GROUP_ID}: ${processorErrors.size} processor(s) failed in batch`,
      );
    }
    throw [...processorErrors.values()][0];
  }
}

async function runParallelScanSourceGroup(
  processors: ReturnType<typeof processorRegistry.listForBuiltInStep<ScanAppInput, CreateIntents>>,
  store: RunEntityStore,
  parallel: ProcessorGroupParallelContext,
  progressStepId: string,
): Promise<void> {
  const { assembly, rest } = partitionScanSourceProcessors(processors);

  await runParallelScanSourcePhase(
    assembly,
    store,
    parallel,
    progressStepId,
    "assembly",
  );
  await runParallelScanSourcePhase(rest, store, parallel, progressStepId, "rest");
}

async function runParallelScanLinkGroup(
  processors: ReturnType<typeof processorRegistry.listForBuiltInStep<ScanAppInput, CreateIntents>>,
  snapshot: DiscoveryModelSnapshot,
  store: RunEntityStore,
  parallel: ProcessorGroupParallelContext,
  progress?: StepProgressHandle,
): Promise<void> {
  const tasks = buildScanLinkTasks(processors, snapshot);
  const processorByTaskId = new Map<string, ProcessorId>(
    tasks.map((task) => [task.taskId, task.input.processor]),
  );

  const { results } = await runScanProcessorPool(
    parallel.pool,
    parallel.bridge,
    tasks,
    parallel.continueOnError,
    "scan.transform",
  );

  mergeParallelCreateIntentResults("scan.transform", store, processorByTaskId, results);

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
