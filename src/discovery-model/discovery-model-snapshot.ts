import type { DiscoveryEntityRecord, EntityType } from "./entity-types.js";

export interface DiscoveryModelSnapshot {
  readonly scanId: string;
  readonly sourceRoot: string;
  readonly runStartedAt: Date;
  listEntities(entityType: EntityType): readonly DiscoveryEntityRecord[];
  getEntity(entityType: EntityType, id: string): DiscoveryEntityRecord | undefined;
}

export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.freeze(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    return value;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }

  return value;
}
