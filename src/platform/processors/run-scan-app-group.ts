import type { DiscoveryModelSnapshot } from "../../discovery-model/discovery-model-snapshot.js";
import type { RunEntityStore } from "../../discovery-model/run-entity-store.js";
import type { ProcessorFilters } from "./processor-filters.js";
import { runCreateIntentProcessorGroup } from "./run-create-intent-processor-group.js";

export function runScanAppGroup(
  snapshot: DiscoveryModelSnapshot,
  filters: ProcessorFilters,
  store: RunEntityStore,
): void {
  runCreateIntentProcessorGroup("scan-app", snapshot, filters, store);
}
