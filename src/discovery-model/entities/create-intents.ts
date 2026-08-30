import type { Entity } from "./entity.js";
import type { DiscoveryEntityCreateIntent } from "./entity-base.js";
import type { EntityType } from "./entity-types.js";

export type CreateIntentRecord = DiscoveryEntityCreateIntent | Entity;

export interface CreateIntents {
  readonly entities?: Partial<Record<EntityType, readonly CreateIntentRecord[]>>;
  readonly links?: Partial<Record<string, readonly Record<string, string>[]>>;
}
