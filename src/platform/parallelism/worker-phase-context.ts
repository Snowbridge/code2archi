import type {
  SerializableDiscoverySnapshot,
  SnapshotRepositoryFilterScope,
} from "./snapshot-serialization.js";
import { getScanIoCacheOptions, initScanIoCache, resetScanIoCache } from "../scan-io/index.js";
import { resetSnapshotCache } from "./worker-snapshot-cache.js";

export interface WorkerPhaseContext {
  readonly phaseId: string;
  readonly snapshot: SerializableDiscoverySnapshot;
  readonly snapshotFilterScope: SnapshotRepositoryFilterScope;
}

let currentPhase: WorkerPhaseContext | null = null;

export function setWorkerPhase(
  phaseId: string,
  snapshot: SerializableDiscoverySnapshot,
  snapshotFilterScope: SnapshotRepositoryFilterScope,
): void {
  resetSnapshotCache();
  resetScanIoCache();
  initScanIoCache(getScanIoCacheOptions());
  currentPhase = { phaseId, snapshot, snapshotFilterScope };
}

export function getWorkerPhase(): WorkerPhaseContext {
  if (!currentPhase) {
    throw new Error("Worker phase is not initialized; call setupPhase before scan.extract tasks");
  }
  return currentPhase;
}

export function tryGetWorkerPhase(): WorkerPhaseContext | null {
  return currentPhase;
}

export function clearWorkerPhase(): void {
  currentPhase = null;
  resetSnapshotCache();
}
