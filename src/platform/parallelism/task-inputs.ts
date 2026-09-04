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
  readonly snapshot: SerializableDiscoverySnapshot;
  readonly repositoryId?: string;
  readonly snapshotFilterScope?: SnapshotRepositoryFilterScope;
  readonly progressStepId?: string;
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
