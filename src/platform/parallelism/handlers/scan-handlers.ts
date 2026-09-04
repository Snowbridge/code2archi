import path from "node:path";
import type { CreateIntents } from "../../../discovery-model/entities/create-intents.js";
import type { Repository } from "../../../discovery-model/entities/repository.js";
import { processorRegistry } from "../../processors/processor-registry.js";
import type { ScanAppInput, ScanScopeInput } from "../../processors/processor.js";
import { GitWorkingCopy } from "../../../utils/git-working-copy.js";
import { RepositoryBuilder } from "../../../utils/repository-builder.js";
import {
  deserializeDiscoverySnapshot,
  filterSerializableDiscoverySnapshotToRepository,
} from "../snapshot-serialization.js";
import type { ScanProcessorTaskInput, ScanScopeUnitTaskInput } from "../task-inputs.js";
import { createWorkerProgressHandle } from "../worker-runtime.js";
import { WORKER_HANDLER_SCAN_SCOPE_UNIT } from "../worker-handler-id.js";

export function runScanProcessorTask(input: ScanProcessorTaskInput): CreateIntents {
  const snapshotData = input.repositoryId
    ? filterSerializableDiscoverySnapshotToRepository(input.snapshot, input.repositoryId)
    : input.snapshot;
  const snapshot = deserializeDiscoverySnapshot(snapshotData);
  const progress = input.progressStepId
    ? createWorkerProgressHandle(input.progressStepId)
    : undefined;

  const processor = processorRegistry.get(input.processor.groupId, input.processor.artifactId);
  if (!processor) {
    throw new Error(
      `Processor not found: ${input.processor.groupId}/${input.processor.artifactId}`,
    );
  }

  const scanInput: ScanAppInput = progress
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

  processor.logStart();
  const output = processor.process(scanInput) as CreateIntents;
  if (output instanceof Promise) {
    throw new Error(
      `Processor ${input.processor.groupId}/${input.processor.artifactId} returned a Promise`,
    );
  }

  const count =
    (output.entities
      ? Object.values(output.entities).reduce((sum, records) => sum + (records?.length ?? 0), 0)
      : 0) +
    (output.links
      ? Object.values(output.links).reduce((sum, records) => sum + (records?.length ?? 0), 0)
      : 0);
  processor.logCompleted(count);
  return output;
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

  const output = processor.process(scopeInput) as readonly Repository[];
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
