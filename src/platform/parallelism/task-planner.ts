import path from "node:path";
import { GitWorkingCopy } from "../../utils/git-working-copy.js";
import type { ProcessorId } from "../processors/processor.js";
import type { ParallelTask } from "./worker-pool.js";
import type { ScanProcessorTaskInput, ScanScopeUnitDescriptor, ScanScopeUnitTaskInput } from "./task-inputs.js";
import { isSupportedScanScopeUnitProcessor } from "./handlers/scan-handlers.js";
import { serializeDiscoverySnapshot } from "./snapshot-serialization.js";
import type { DiscoveryModelSnapshot } from "../../discovery-model/run-entity-store.js";
import type { SerializableDiscoverySnapshot } from "./snapshot-serialization.js";

export function buildScanSourceTasks(
  processors: readonly { readonly id: ProcessorId }[],
  snapshot: DiscoveryModelSnapshot,
  progressStepId: string,
): ParallelTask<ScanProcessorTaskInput>[] {
  const serialized = serializeDiscoverySnapshot(snapshot);
  const repositories = snapshot.listEntities("Repository");
  const tasks: ParallelTask<ScanProcessorTaskInput>[] = [];

  for (const processor of processors) {
    for (const repository of repositories) {
      tasks.push({
        taskId: `${processor.id.groupId}/${processor.id.artifactId}:${repository.id}`,
        input: {
          processor: processor.id,
          snapshot: serialized,
          repositoryId: repository.id,
          progressStepId,
        },
      });
    }
  }

  return tasks;
}

export function buildScanLinkTasks(
  processors: readonly { readonly id: ProcessorId }[],
  snapshot: DiscoveryModelSnapshot,
): ParallelTask<ScanProcessorTaskInput>[] {
  const serialized = serializeDiscoverySnapshot(snapshot);

  return processors.map((processor) => ({
    taskId: `${processor.id.groupId}/${processor.id.artifactId}`,
    input: {
      processor: processor.id,
      snapshot: serialized,
    },
  }));
}

export function buildScanScopeTasks(
  processors: readonly { readonly id: ProcessorId }[],
  sourceDirs: readonly string[],
  progressStepId: string,
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
): ParallelTask<import("./task-inputs.js").GenerateProcessorTaskInput>[] {
  return processors.map((processor) => ({
    taskId: `${processor.id.groupId}/${processor.id.artifactId}`,
    input: {
      processor: processor.id,
      discovery,
      archi,
      decorate,
    },
  }));
}
