import type { RunEntityStore } from "../../discovery-model/run-entity-store.js";
import type { ProcessorFilters } from "./processor-filters.js";
import { runCreateIntentProcessorGroup } from "./run-create-intent-processor-group.js";
import type { DiscoveryModelSnapshot } from "../../discovery-model/run-entity-store.js";

export function runScanTechGroup(
  snapshot: DiscoveryModelSnapshot,
  filters: ProcessorFilters,
  store: RunEntityStore,
): void {
  runCreateIntentProcessorGroup("scan-tech", snapshot, filters, store);
}
