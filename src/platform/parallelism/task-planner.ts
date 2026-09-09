import path from "node:path";
import { GitWorkingCopy } from "../../utils/git-working-copy.js";
import type { ProcessorId } from "../processors/processor.js";
import {
  filterSupplementsForProcessor,
  type ProcessorSupplementCatalog,
} from "../processors/processor-supplements.js";
import type { ParallelTask } from "./worker-pool.js";
import type {
  ScanProcessorTaskInput,
  ScanRepositoryBatchTaskInput,
  ScanScopeUnitDescriptor,
  ScanScopeUnitTaskInput,
} from "./task-inputs.js";
import { isSupportedScanScopeUnitProcessor } from "./handlers/scan-handlers.js";
import type { SnapshotRepositoryFilterScope } from "./snapshot-serialization.js";
import {
  serializeDiscoverySnapshot,
  type SerializableDiscoverySnapshot,
} from "./snapshot-serialization.js";
import type { CodeInventorySnapshot } from "../../code-inventory/run-entity-store.js";

export function buildScanSourceTasks(
  processors: readonly { readonly id: ProcessorId }[],
  snapshot: CodeInventorySnapshot,
  progressStepId: string,
): ParallelTask<ScanProcessorTaskInput>[] {
  const repositories = snapshot.listEntities("Repository");
  const tasks: ParallelTask<ScanProcessorTaskInput>[] = [];

  for (const processor of processors) {
    for (const repository of repositories) {
      tasks.push({
        taskId: `${processor.id.groupId}/${processor.id.artifactId}:${repository.id}`,
        input: {
          processor: processor.id,
          repositoryId: repository.id,
          progressStepId,
        },
      });
    }
  }

  return tasks;
}

export function buildScanRepositoryBatchTasks(
  processors: readonly { readonly id: ProcessorId }[],
  snapshot: CodeInventorySnapshot,
  progressStepId: string,
  phaseScope: SnapshotRepositoryFilterScope,
  continueOnError: boolean,
): ParallelTask<ScanRepositoryBatchTaskInput>[] {
  const processorIds = processors.map((processor) => processor.id);
  const repositories = snapshot.listEntities("Repository");

  return repositories.map((repository) => ({
    taskId: `scan.extract:${phaseScope}:${repository.id}`,
    input: {
      repositoryId: repository.id,
      processors: processorIds,
      progressStepId,
      continueOnError,
    },
  }));
}

export function buildScanLinkTasks(
  processors: readonly { readonly id: ProcessorId }[],
  snapshot: CodeInventorySnapshot,
  supplementCatalog?: ProcessorSupplementCatalog,
): ParallelTask<ScanProcessorTaskInput>[] {
  const serialized = serializeDiscoverySnapshot(snapshot);

  return processors.map((processor) => ({
    taskId: `${processor.id.groupId}/${processor.id.artifactId}`,
    input: {
      processor: processor.id,
      snapshot: serialized,
      supplements: supplementCatalog
        ? filterSupplementsForProcessor(supplementCatalog, processor.id)
        : undefined,
    },
  }));
}

export function buildScanScopeTasks(
  processors: readonly { readonly id: ProcessorId }[],
  sourceDirs: readonly string[],
  progressStepId: string,
  supplementCatalog?: ProcessorSupplementCatalog,
): ParallelTask<ScanScopeUnitTaskInput>[] {
  const tasks: ParallelTask<ScanScopeUnitTaskInput>[] = [];

  for (const processor of processors) {
    if (!isSupportedScanScopeUnitProcessor(processor.id.artifactId)) {
      continue;
    }

    if (processor.id.artifactId === "git-repositories") {
      const repoRoots = GitWorkingCopy.findRepoRootsInSourceDirs(sourceDirs);
      for (const repoRoot of repoRoots) {
        tasks.push({
          taskId: `${processor.id.groupId}/${processor.id.artifactId}:${repoRoot}`,
          input: {
            processor: processor.id,
            sourceDirs,
            unit: { kind: "repoRoot", path: repoRoot } satisfies ScanScopeUnitDescriptor,
            progressStepId,
            supplements: supplementCatalog
              ? filterSupplementsForProcessor(supplementCatalog, processor.id)
              : undefined,
          },
        });
      }
      continue;
    }

    if (processor.id.artifactId === "unversioned-folders") {
      for (const sourceDir of sourceDirs) {
        tasks.push({
          taskId: `${processor.id.groupId}/${processor.id.artifactId}:${path.resolve(sourceDir)}`,
          input: {
            processor: processor.id,
            sourceDirs,
            unit: { kind: "sourceDir", path: sourceDir } satisfies ScanScopeUnitDescriptor,
            progressStepId,
            supplements: supplementCatalog
              ? filterSupplementsForProcessor(supplementCatalog, processor.id)
              : undefined,
          },
        });
      }
    }
  }

  return tasks;
}

export function buildGenerateProcessorTasks(
  processors: readonly { readonly id: ProcessorId }[],
  discovery: SerializableDiscoverySnapshot,
  archi: import("./snapshot-serialization.js").SerializableArchiSnapshot,
  decorate: boolean,
  supplementCatalog?: ProcessorSupplementCatalog,
): ParallelTask<import("./task-inputs.js").GenerateProcessorTaskInput>[] {
  return processors.map((processor) => ({
    taskId: `${processor.id.groupId}/${processor.id.artifactId}`,
    input: {
      processor: processor.id,
      discovery,
      archi,
      decorate,
      supplements: supplementCatalog
        ? filterSupplementsForProcessor(supplementCatalog, processor.id)
        : undefined,
    },
  }));
}
