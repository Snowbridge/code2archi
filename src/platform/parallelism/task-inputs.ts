import type { CreateIntents } from "../../discovery-model/entities/create-intents.js";
import type { ProcessorId } from "../processors/processor.js";
import type {
  SerializableDiscoverySnapshot,
  SnapshotRepositoryFilterScope,
} from "./snapshot-serialization.js";

export interface ScanScopeUnitDescriptor {
  readonly kind: "repoRoot" | "sourceDir";
  readonly path: string;
}

export interface ScanProcessorTaskInput {
  readonly processor: ProcessorId;
  readonly snapshot?: SerializableDiscoverySnapshot;
  readonly repositoryId?: string;
  readonly snapshotFilterScope?: SnapshotRepositoryFilterScope;
  readonly progressStepId?: string;
}

export interface ScanRepositoryBatchTaskInput {
  readonly repositoryId: string;
  readonly processors: readonly ProcessorId[];
  readonly progressStepId?: string;
  readonly continueOnError: boolean;
}

export interface ScanRepositoryBatchProcessorError {
  readonly message: string;
  readonly stack?: string;
}

export interface ScanRepositoryBatchTaskResult {
  readonly outputs: Readonly<Record<string, CreateIntents>>;
  readonly errors?: Readonly<Record<string, ScanRepositoryBatchProcessorError>>;
}

export function formatProcessorTaskKey(processorId: ProcessorId): string {
  return `${processorId.groupId}/${processorId.artifactId}`;
}

export function parseProcessorTaskKey(key: string): ProcessorId {
  const separatorIndex = key.indexOf("/");
  if (separatorIndex <= 0 || separatorIndex === key.length - 1) {
    throw new Error(`Invalid processor task key: ${key}`);
  }
  return {
    groupId: key.slice(0, separatorIndex),
    artifactId: key.slice(separatorIndex + 1),
  };
}

export interface ScanScopeUnitTaskInput {
  readonly processor: ProcessorId;
  readonly sourceDirs: readonly string[];
  readonly unit: ScanScopeUnitDescriptor;
  readonly progressStepId?: string;
}

export interface GenerateProcessorTaskInput {
  readonly processor: ProcessorId;
  readonly discovery: SerializableDiscoverySnapshot;
  readonly archi: import("./snapshot-serialization.js").SerializableArchiSnapshot;
  readonly decorate: boolean;
}
