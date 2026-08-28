import type { CreateIntents } from "../../discovery-model/create-intents.js";
import type { DiscoveryEntityCreateIntent } from "../../discovery-model/entity-base.js";
import type { EntityType } from "../../discovery-model/entity-types.js";

export function mergeCreateIntents(
  left: CreateIntents,
  right: CreateIntents,
): CreateIntents {
  const entities: Partial<Record<EntityType, DiscoveryEntityCreateIntent[]>> = {};

  for (const source of [left.entities, right.entities]) {
    if (!source) {
      continue;
    }

    for (const [entityTypeKey, records] of Object.entries(source)) {
      if (!records || records.length === 0) {
        continue;
      }

      const entityType = entityTypeKey as EntityType;
      const bucket = entities[entityType] ?? [];
      entities[entityType] = bucket;

      for (const record of records) {
        if (bucket.some((existing) => existing.id === record.id)) {
          throw new Error(`Duplicate ${entityType} id: ${record.id}`);
        }
        bucket.push(record);
      }
    }
  }

  return {
    entities: Object.keys(entities).length > 0 ? entities : undefined,
    links: left.links ?? right.links,
  };
}
