import type { CreateIntents } from "../../discovery-model/entities/create-intents.js";
import type { DiscoveryModelSnapshot } from "../../discovery-model/run-entity-store.js";

export type ScanAppInput = DiscoveryModelSnapshot;
export type ScanAppOutput = CreateIntents;
