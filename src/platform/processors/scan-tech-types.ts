import type { CreateIntents } from "../../discovery-model/entities/create-intents.js";
import type { DiscoveryModelSnapshot } from "../../discovery-model/run-entity-store.js";

export type ScanTechInput = DiscoveryModelSnapshot;
export type ScanTechOutput = CreateIntents;
