import { ENTITY_REF_INDEX_FIELDS } from "./entity-ref-indexes.js";
import { LINK_REF_INDEX_FIELDS } from "./link-ref-indexes.js";
import type { DiscoveryEntityRecord, EntityType } from "./entities/entity-types.js";
import { ENTITY_TYPES } from "./entities/entity-types.js";
import type { DiscoveryLinkRecord } from "./links/link-records.js";
import type { LinkType } from "./links/link-types.js";
import { LINK_TYPES } from "./links/link-types.js";

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
  listLinks(linkType: LinkType): readonly DiscoveryLinkRecord[];
  getLink(linkType: LinkType, id: string): DiscoveryLinkRecord | undefined;
  listLinksByRef(
    linkType: LinkType,
    field: string,
    value: string,
  ): readonly DiscoveryLinkRecord[];
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
  readonly linkMaps?: ReadonlyMap<LinkType, ReadonlyMap<string, DiscoveryLinkRecord>>;
  readonly linkArrays?: Readonly<Partial<Record<LinkType, readonly DiscoveryLinkRecord[]>>>;
}

type EntityBucket = ReadonlyMap<string, DiscoveryEntityRecord>;
type EntitiesByType = ReadonlyMap<EntityType, EntityBucket>;
type GlobalIdIndex = ReadonlyMap<string, DiscoveryEntityRecord>;
type RefIndex = ReadonlyMap<
  EntityType,
  ReadonlyMap<string, ReadonlyMap<string, readonly DiscoveryEntityRecord[]>>
>;

type LinkBucket = ReadonlyMap<string, DiscoveryLinkRecord>;
type LinksByType = ReadonlyMap<LinkType, LinkBucket>;
type LinkRefIndex = ReadonlyMap<
  LinkType,
  ReadonlyMap<string, ReadonlyMap<string, readonly DiscoveryLinkRecord[]>>
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

function normalizeLinkMaps(
  init: BuildDiscoveryModelSnapshotInit,
): Map<LinkType, Map<string, DiscoveryLinkRecord>> {
  if (init.linkMaps) {
    const normalized = new Map<LinkType, Map<string, DiscoveryLinkRecord>>();
    for (const [linkType, bucket] of init.linkMaps) {
      normalized.set(linkType, new Map(bucket));
    }
    return normalized;
  }

  const normalized = new Map<LinkType, Map<string, DiscoveryLinkRecord>>();
  for (const [linkTypeKey, records] of Object.entries(init.linkArrays ?? {})) {
    if (!records || records.length === 0) {
      continue;
    }

    const linkType = linkTypeKey as LinkType;
    const bucket = new Map<string, DiscoveryLinkRecord>();
    for (const record of records) {
      bucket.set(record.id, record);
    }
    normalized.set(linkType, bucket);
  }

  return normalized;
}

function buildEntityIndexes(entityMaps: Map<EntityType, Map<string, DiscoveryEntityRecord>>): {
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

function buildLinkIndexes(linkMaps: Map<LinkType, Map<string, DiscoveryLinkRecord>>): {
  readonly linksByType: LinksByType;
  readonly linkRefIndex: LinkRefIndex;
} {
  const frozenLinksByType = new Map<LinkType, LinkBucket>();
  const linkRefIndex = new Map<
    LinkType,
    ReadonlyMap<string, ReadonlyMap<string, readonly DiscoveryLinkRecord[]>>
  >();

  for (const linkType of LINK_TYPES) {
    const bucket = linkMaps.get(linkType);
    if (!bucket || bucket.size === 0) {
      continue;
    }

    const sortedRecords = [...bucket.values()].sort((a, b) => a.id.localeCompare(b.id));
    const frozenBucket = deepFreeze(
      new Map(sortedRecords.map((record) => [record.id, deepFreeze({ ...record })])),
    );
    frozenLinksByType.set(linkType, frozenBucket);

    const refFields = LINK_REF_INDEX_FIELDS[linkType];
    if (!refFields) {
      continue;
    }

    const fieldIndex = new Map<string, Map<string, DiscoveryLinkRecord[]>>();
    for (const field of refFields) {
      fieldIndex.set(field, new Map());
    }

    for (const record of sortedRecords) {
      for (const field of refFields) {
        const fieldValue = (record as unknown as Record<string, unknown>)[field];
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

    const frozenFieldIndex = new Map<string, ReadonlyMap<string, readonly DiscoveryLinkRecord[]>>();
    for (const [field, byValue] of fieldIndex) {
      const frozenByValue = new Map<string, readonly DiscoveryLinkRecord[]>();
      for (const [key, matches] of byValue) {
        frozenByValue.set(key, deepFreeze([...matches]));
      }
      frozenFieldIndex.set(field, deepFreeze(frozenByValue));
    }

    linkRefIndex.set(linkType, deepFreeze(frozenFieldIndex));
  }

  return {
    linksByType: deepFreeze(frozenLinksByType),
    linkRefIndex: deepFreeze(linkRefIndex),
  };
}

class IndexedDiscoveryModelSnapshot implements DiscoveryModelSnapshot {
  private readonly entitiesByType: EntitiesByType;
  private readonly globalIdIndex: GlobalIdIndex;
  private readonly refIndex: RefIndex;
  private readonly linksByType: LinksByType;
  private readonly linkRefIndex: LinkRefIndex;

  constructor(
    readonly scanId: string,
    readonly sourceRoot: string,
    readonly sourceDirs: readonly string[],
    readonly repositoryCommonRoot: string,
    readonly runStartedAt: Date,
    entityIndexes: {
      readonly entitiesByType: EntitiesByType;
      readonly globalIdIndex: GlobalIdIndex;
      readonly refIndex: RefIndex;
    },
    linkIndexes: {
      readonly linksByType: LinksByType;
      readonly linkRefIndex: LinkRefIndex;
    },
  ) {
    this.entitiesByType = entityIndexes.entitiesByType;
    this.globalIdIndex = entityIndexes.globalIdIndex;
    this.refIndex = entityIndexes.refIndex;
    this.linksByType = linkIndexes.linksByType;
    this.linkRefIndex = linkIndexes.linkRefIndex;
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

  listLinks(linkType: LinkType): readonly DiscoveryLinkRecord[] {
    const bucket = this.linksByType.get(linkType);
    if (!bucket) {
      return [];
    }

    return [...bucket.values()];
  }

  getLink(linkType: LinkType, id: string): DiscoveryLinkRecord | undefined {
    return this.linksByType.get(linkType)?.get(id);
  }

  listLinksByRef(
    linkType: LinkType,
    field: string,
    value: string,
  ): readonly DiscoveryLinkRecord[] {
    const indexedFields = LINK_REF_INDEX_FIELDS[linkType];
    if (!indexedFields || !indexedFields.includes(field)) {
      return [];
    }

    return this.linkRefIndex.get(linkType)?.get(field)?.get(value) ?? [];
  }
}

export function buildDiscoveryModelSnapshot(
  init: BuildDiscoveryModelSnapshotInit,
): DiscoveryModelSnapshot {
  if (!init.entityMaps && !init.entityArrays) {
    throw new Error("buildDiscoveryModelSnapshot requires entityMaps or entityArrays");
  }

  const entityMaps = normalizeEntityMaps(init);
  const linkMaps = normalizeLinkMaps(init);
  const entityIndexes = buildEntityIndexes(entityMaps);
  const linkIndexes = buildLinkIndexes(linkMaps);

  return deepFreeze(
    new IndexedDiscoveryModelSnapshot(
      init.scanId,
      init.sourceRoot,
      init.sourceDirs ?? [],
      init.repositoryCommonRoot ?? "",
      init.runStartedAt,
      entityIndexes,
      linkIndexes,
    ),
  );
}
