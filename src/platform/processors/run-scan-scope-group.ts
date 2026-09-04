import { SCAN_SCOPE_GROUP_ID } from "../../cli/processor-groups.js";
import type { StepProgressHandle } from "../cli-progress/types.js";
import type { RunEntityStore } from "../../discovery-model/run-entity-store.js";
import { WORKER_HANDLER_SCAN_SCOPE_UNIT } from "../parallelism/worker-handler-id.js";
import { buildScanScopeTasks } from "../parallelism/task-planner.js";
import { isSupportedScanScopeUnitProcessor } from "../parallelism/handlers/scan-handlers.js";
import type { ProcessorGroupParallelContext } from "./run-create-intent-processor-group.js";
import { runProcessorWithMetrics } from "../profiling/flow-metrics.js";
import type { ProcessorFilters } from "./processor-registry.js";
import { processorRegistry } from "./processor-registry.js";
import type { ScanScopeInput, ScanScopeOutput } from "./processor.js";
import { getLogger } from "../logging/index.js";
import { throwOnPoolErrors } from "./parallel-group-runner.js";
import type { Repository } from "../../discovery-model/entities/repository.js";

export function runScanScopeGroup(
  sourceDirs: readonly string[],
  filters: ProcessorFilters,
  store: RunEntityStore,
  progress?: StepProgressHandle,
  parallel?: ProcessorGroupParallelContext,
): void {
  const logger = getLogger("scan.scope");
  logger.info("group start", { groupId: SCAN_SCOPE_GROUP_ID, sourceDirCount: sourceDirs.length });

  const processors = processorRegistry.listForBuiltInStep<ScanScopeInput, ScanScopeOutput>(
    SCAN_SCOPE_GROUP_ID,
    filters,
  );

  const parallelizable = processors.filter((processor) =>
    isSupportedScanScopeUnitProcessor(processor.id.artifactId),
  );
  const sequential = processors.filter(
    (processor) => !isSupportedScanScopeUnitProcessor(processor.id.artifactId),
  );

  if (parallel && parallelizable.length > 0) {
    const tasks = buildScanScopeTasks(parallelizable, sourceDirs, "1");
    if (tasks.length > 0) {
      const gitProcessor = parallelizable.find(
        (processor) => processor.id.artifactId === "git-repositories",
      );
      if (gitProcessor) {
        const repoCount = tasks.filter((task) =>
          task.taskId.startsWith(`${gitProcessor.id.groupId}/${gitProcessor.id.artifactId}:`),
        ).length;
        if (repoCount > 0) {
          progress?.setTotal(repoCount);
        }
      }

      const { results, errors } = parallel.pool.runTasks({
        handlerId: WORKER_HANDLER_SCAN_SCOPE_UNIT,
        tasks,
        bridge: parallel.bridge,
      });
      throwOnPoolErrors(SCAN_SCOPE_GROUP_ID, errors, parallel.continueOnError);

      const repositoriesByProcessor = new Map<string, Repository[]>();
      for (const task of tasks) {
        const output = results.get(task.taskId) as readonly Repository[] | undefined;
        if (!output || output.length === 0) {
          continue;
        }
        const key = `${task.input.processor.groupId}/${task.input.processor.artifactId}`;
        const bucket = repositoriesByProcessor.get(key) ?? [];
        bucket.push(...output);
        repositoriesByProcessor.set(key, bucket);
      }

      for (const processor of parallelizable) {
        const key = `${processor.id.groupId}/${processor.id.artifactId}`;
        const repositories = repositoriesByProcessor.get(key) ?? [];
        if (repositories.length === 0) {
          processor.logCompleted(0);
          continue;
        }

        store.addCreateIntents(SCAN_SCOPE_GROUP_ID, processor.id, {
          entities: { Repository: repositories },
        });
        processor.logCompleted(repositories.length);
      }
    }
  } else {
    const input: ScanScopeInput = { sourceDirs, progress };

    for (const processor of parallelizable) {
      processor.logStart();
      const output = runProcessorWithMetrics(processor.id, () => processor.process(input));
      if (output instanceof Promise) {
        throw new Error(
          `Processor ${processor.id.groupId}/${processor.id.artifactId} returned a Promise; sync execution expected`,
        );
      }

      if (output.length === 0) {
        processor.logCompleted(0);
        continue;
      }

      store.addCreateIntents(SCAN_SCOPE_GROUP_ID, processor.id, {
        entities: { Repository: [...output] },
      });
      processor.logCompleted(output.length);
    }
  }

  const input: ScanScopeInput = { sourceDirs, progress };
  for (const processor of sequential) {
    processor.logStart();
    const output = runProcessorWithMetrics(processor.id, () => processor.process(input));
    if (output instanceof Promise) {
      throw new Error(
        `Processor ${processor.id.groupId}/${processor.id.artifactId} returned a Promise; sync execution expected`,
      );
    }

    if (output.length === 0) {
      processor.logCompleted(0);
      continue;
    }

    store.addCreateIntents(SCAN_SCOPE_GROUP_ID, processor.id, {
      entities: { Repository: [...output] },
    });
    processor.logCompleted(output.length);
  }

  logger.info("group completed", {
    groupId: SCAN_SCOPE_GROUP_ID,
    repositoryCount: store.getEntities("Repository").length,
  });
}
