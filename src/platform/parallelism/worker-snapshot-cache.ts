import type { DiscoveryModelSnapshot } from "../../discovery-model/run-entity-store.js";
import {
  deserializeDiscoverySnapshot,
  filterSerializableDiscoverySnapshotToRepository,
  type SnapshotRepositoryFilterScope,
} from "./snapshot-serialization.js";
import { getWorkerPhase } from "./worker-phase-context.js";

const cache = new Map<string, DiscoveryModelSnapshot>();

function cacheKey(repositoryId: string, scope: SnapshotRepositoryFilterScope): string {
  return `${repositoryId}:${scope}`;
}

export function getOrBuildRepositorySnapshot(repositoryId: string): DiscoveryModelSnapshot {
  const phase = getWorkerPhase();
  const key = cacheKey(repositoryId, phase.snapshotFilterScope);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const filtered = filterSerializableDiscoverySnapshotToRepository(
    phase.snapshot,
    repositoryId,
    phase.snapshotFilterScope,
  );
  const snapshot = deserializeDiscoverySnapshot(filtered);
  cache.set(key, snapshot);
  return snapshot;
}

export function resetSnapshotCache(): void {
  cache.clear();
}
