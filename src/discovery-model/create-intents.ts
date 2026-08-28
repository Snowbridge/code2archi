import type { DiscoveryEntityRecord, EntityType } from "./entity-types.js";

export interface CreateIntents {
  readonly entities?: Partial<Record<EntityType, readonly DiscoveryEntityRecord[]>>;
  readonly links?: Partial<Record<string, readonly Record<string, string>[]>>;
}

export function emptyCreateIntents(): CreateIntents {
  return { entities: {}, links: {} };
}
