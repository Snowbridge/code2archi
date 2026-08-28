import type { DiscoveryEntityCreateIntent } from "./entity-base.js";
import type { EntityType } from "./entity-types.js";

export interface CreateIntents {
  readonly entities?: Partial<
    Record<EntityType, readonly DiscoveryEntityCreateIntent[]>
  >;
  readonly links?: Partial<Record<string, readonly Record<string, string>[]>>;
}
