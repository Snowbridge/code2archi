import { ENTITY_REF_INDEX_FIELDS } from "./entity-ref-indexes.js";
import type { DiscoveryEntityRecord, EntityType } from "./entities/entity-types.js";
import { ENTITY_TYPES } from "./entities/entity-types.js";

export interface DiscoveryModelSnapshot {
  readonly scanId: string;
  readonly sourceRoot: string;
  readonly sourceDirs: readonly string[];
  readonly repositoryCommonRoot: string;
  readonly runStartedAt: Date;
  listEntities(entityType: EntityType): readonly DiscoveryEntityRecord[];
  getEntity(entityType: EntityType, id: string): DiscoveryEntityRecord | undefined;
  getById(id: string): DiscoveryEntityRecord | undefined;
  listEntitiesByRef(
    entityType: EntityType,
    field: string,
    value: string,
  ): readonly DiscoveryEntityRecord[];
}

export interface BuildDiscoveryModelSnapshotInit {
  readonly scanId: string;
  readonly sourceRoot: string;
  readonly sourceDirs?: readonly string[];
  readonly repositoryCommonRoot?: string;
  readonly runStartedAt: Date;
  readonly entityMaps?: ReadonlyMap<
    EntityType,
    ReadonlyMap<string, DiscoveryEntityRecord>
  >;
  readonly entityArrays?: Readonly<
    Partial<Record<EntityType, readonly DiscoveryEntityRecord[]>>
  >;
}

type EntityBucket = ReadonlyMap<string, DiscoveryEntityRecord>;
type EntitiesByType = ReadonlyMap<EntityType, EntityBucket>;
type GlobalIdIndex = ReadonlyMap<string, DiscoveryEntityRecord>;
type RefIndex = ReadonlyMap<
  EntityType,
  ReadonlyMap<string, ReadonlyMap<string, readonly DiscoveryEntityRecord[]>>
>;

function deepFreeze<T>(value: T): T {
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

function normalizeEntityMaps(
  init: BuildDiscoveryModelSnapshotInit,
): Map<EntityType, Map<string, DiscoveryEntityRecord>> {
  if (init.entityMaps) {
    const normalized = new Map<EntityType, Map<string, DiscoveryEntityRecord>>();
    for (const [entityType, bucket] of init.entityMaps) {
      normalized.set(entityType, new Map(bucket));
    }
    return normalized;
  }

  const normalized = new Map<EntityType, Map<string, DiscoveryEntityRecord>>();
  for (const [entityTypeKey, records] of Object.entries(init.entityArrays ?? {})) {
    if (!records || records.length === 0) {
      continue;
    }

    const entityType = entityTypeKey as EntityType;
    const bucket = new Map<string, DiscoveryEntityRecord>();
    for (const record of records) {
      bucket.set(record.id, record);
    }
    normalized.set(entityType, bucket);
  }

  return normalized;
}

function buildIndexes(entityMaps: Map<EntityType, Map<string, DiscoveryEntityRecord>>): {
  readonly entitiesByType: EntitiesByType;
  readonly globalIdIndex: GlobalIdIndex;
  readonly refIndex: RefIndex;
} {
  const frozenEntitiesByType = new Map<EntityType, EntityBucket>();
  const globalIdIndex = new Map<string, DiscoveryEntityRecord>();
  const refIndex = new Map<
    EntityType,
    ReadonlyMap<string, ReadonlyMap<string, readonly DiscoveryEntityRecord[]>>
  >();

  for (const entityType of ENTITY_TYPES) {
    const bucket = entityMaps.get(entityType);
    if (!bucket || bucket.size === 0) {
      continue;
    }

    const sortedRecords = [...bucket.values()].sort((a, b) => a.id.localeCompare(b.id));
    const frozenBucket = deepFreeze(
      new Map(sortedRecords.map((record) => [record.id, deepFreeze({ ...record })])),
    );
    frozenEntitiesByType.set(entityType, frozenBucket);

    for (const record of sortedRecords) {
      globalIdIndex.set(record.id, record);
    }

    const refFields = ENTITY_REF_INDEX_FIELDS[entityType];
    if (!refFields) {
      continue;
    }

    const fieldIndex = new Map<string, Map<string, DiscoveryEntityRecord[]>>();
    for (const field of refFields) {
      fieldIndex.set(field, new Map());
    }

    for (const record of sortedRecords) {
      for (const field of refFields) {
        const fieldValue = record[field];
        if (fieldValue === undefined || fieldValue === null) {
          continue;
        }

        const key = String(fieldValue);
        const byValue = fieldIndex.get(field)!;
        let matches = byValue.get(key);
        if (!matches) {
          matches = [];
          byValue.set(key, matches);
        }
        matches.push(record);
      }
    }

    const frozenFieldIndex = new Map<string, ReadonlyMap<string, readonly DiscoveryEntityRecord[]>>();
    for (const [field, byValue] of fieldIndex) {
      const frozenByValue = new Map<string, readonly DiscoveryEntityRecord[]>();
      for (const [key, matches] of byValue) {
        frozenByValue.set(key, deepFreeze([...matches]));
      }
      frozenFieldIndex.set(field, deepFreeze(frozenByValue));
    }

    refIndex.set(entityType, deepFreeze(frozenFieldIndex));
  }

  return {
    entitiesByType: deepFreeze(frozenEntitiesByType),
    globalIdIndex: deepFreeze(globalIdIndex),
    refIndex: deepFreeze(refIndex),
  };
}

class IndexedDiscoveryModelSnapshot implements DiscoveryModelSnapshot {
  private readonly entitiesByType: EntitiesByType;
  private readonly globalIdIndex: GlobalIdIndex;
  private readonly refIndex: RefIndex;

  constructor(
    readonly scanId: string,
    readonly sourceRoot: string,
    readonly sourceDirs: readonly string[],
    readonly repositoryCommonRoot: string,
    readonly runStartedAt: Date,
    indexes: {
      readonly entitiesByType: EntitiesByType;
      readonly globalIdIndex: GlobalIdIndex;
      readonly refIndex: RefIndex;
    },
  ) {
    this.entitiesByType = indexes.entitiesByType;
    this.globalIdIndex = indexes.globalIdIndex;
    this.refIndex = indexes.refIndex;
  }

  listEntities(entityType: EntityType): readonly DiscoveryEntityRecord[] {
    const bucket = this.entitiesByType.get(entityType);
    if (!bucket) {
      return [];
    }

    return [...bucket.values()];
  }

  getEntity(entityType: EntityType, id: string): DiscoveryEntityRecord | undefined {
    return this.entitiesByType.get(entityType)?.get(id);
  }

  getById(id: string): DiscoveryEntityRecord | undefined {
    return this.globalIdIndex.get(id);
  }

  listEntitiesByRef(
    entityType: EntityType,
    field: string,
    value: string,
  ): readonly DiscoveryEntityRecord[] {
    const indexedFields = ENTITY_REF_INDEX_FIELDS[entityType];
    if (!indexedFields || !indexedFields.includes(field)) {
      return [];
    }

    return this.refIndex.get(entityType)?.get(field)?.get(value) ?? [];
  }
}

export function buildDiscoveryModelSnapshot(
  init: BuildDiscoveryModelSnapshotInit,
): DiscoveryModelSnapshot {
  if (!init.entityMaps && !init.entityArrays) {
    throw new Error("buildDiscoveryModelSnapshot requires entityMaps or entityArrays");
  }

  const entityMaps = normalizeEntityMaps(init);
  const indexes = buildIndexes(entityMaps);

  return deepFreeze(
    new IndexedDiscoveryModelSnapshot(
      init.scanId,
      init.sourceRoot,
      init.sourceDirs ?? [],
      init.repositoryCommonRoot ?? "",
      init.runStartedAt,
      indexes,
    ),
  );
}
