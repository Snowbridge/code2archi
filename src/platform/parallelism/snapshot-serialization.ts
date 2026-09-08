import {
  createArchiModelSnapshot,
  type ArchiModelSnapshot,
} from "../../archimate-model/archi-model-store.js";
import { PREDEFINED_FOLDERS, type PredefinedFolderKey } from "../../archimate-model/concept-types.js";
import type { ArchiElementCreateIntent } from "../../archimate-model/elements/archi-element.js";
import type { ArchiFolder } from "../../archimate-model/folders/archi-folder.js";
import type { ArchiProfileCreateIntent } from "../../archimate-model/profiles/profile.js";
import type { ArchiRelationshipCreateIntent } from "../../archimate-model/relationships/archi-relationship.js";
import { buildCodeInventorySnapshot } from "../../code-inventory/code-inventory-snapshot.js";
import type { CodeInventorySnapshot } from "../../code-inventory/run-entity-store.js";
import type { DiscoveryEntityRecord, EntityType } from "../../code-inventory/entities/entity-types.js";
import { ENTITY_TYPES } from "../../code-inventory/entities/entity-types.js";
import type { DiscoveryLinkRecord } from "../../code-inventory/links/link-records.js";
import type { LinkType } from "../../code-inventory/links/link-types.js";
import { LINK_TYPES } from "../../code-inventory/links/link-types.js";

export interface SerializableDiscoverySnapshot {
  readonly scanId: string;
  readonly sourceRoot: string;
  readonly sourceDirs: readonly string[];
  readonly repositoryCommonRoot: string;
  readonly runStartedAt: string;
  readonly entities: Partial<Record<EntityType, readonly DiscoveryEntityRecord[]>>;
  readonly links: Partial<Record<LinkType, readonly DiscoveryLinkRecord[]>>;
}

export function serializeDiscoverySnapshot(
  snapshot: CodeInventorySnapshot,
): SerializableDiscoverySnapshot {
  const entities: Partial<Record<EntityType, readonly DiscoveryEntityRecord[]>> = {};
  for (const entityType of ENTITY_TYPES) {
    const records = snapshot.listEntities(entityType);
    if (records.length > 0) {
      entities[entityType] = records;
    }
  }

  const links: Partial<Record<LinkType, readonly DiscoveryLinkRecord[]>> = {};
  for (const linkType of LINK_TYPES) {
    const records = snapshot.listLinks(linkType);
    if (records.length > 0) {
      (links as Record<string, readonly DiscoveryLinkRecord[]>)[linkType as string] = records;
    }
  }

  return {
    scanId: snapshot.scanId,
    sourceRoot: snapshot.sourceRoot,
    sourceDirs: snapshot.sourceDirs,
    repositoryCommonRoot: snapshot.repositoryCommonRoot,
    runStartedAt: snapshot.runStartedAt.toISOString(),
    entities,
    links,
  };
}

export function deserializeDiscoverySnapshot(
  data: SerializableDiscoverySnapshot,
): CodeInventorySnapshot {
  return buildCodeInventorySnapshot({
    scanId: data.scanId,
    sourceRoot: data.sourceRoot,
    sourceDirs: data.sourceDirs,
    repositoryCommonRoot: data.repositoryCommonRoot,
    runStartedAt: new Date(data.runStartedAt),
    entityArrays: data.entities,
    linkArrays: data.links,
  });
}

export type SnapshotRepositoryFilterScope = "assembly" | "module-source";

export function filterSerializableDiscoverySnapshotToRepository(
  data: SerializableDiscoverySnapshot,
  repositoryId: string,
  scope: SnapshotRepositoryFilterScope = "assembly",
): SerializableDiscoverySnapshot {
  const repositories = data.entities.Repository ?? [];
  const repository = repositories.find((record) => record.id === repositoryId);
  if (!repository) {
    throw new Error(`Repository not found in snapshot: ${repositoryId}`);
  }

  if (scope === "assembly") {
    return {
      ...data,
      entities: {
        Repository: [repository],
      },
      links: {},
    };
  }

  const modules =
    data.entities.ApplicationModule?.filter((module) => module.repositoryId === repositoryId) ??
    [];

  return {
    ...data,
    entities: {
      Repository: [repository],
      ...(modules.length > 0 ? { ApplicationModule: modules } : {}),
    },
    links: {},
  };
}

export interface SerializableArchiSnapshot {
  readonly folders: readonly ArchiFolder[];
  readonly elements: readonly ArchiElementCreateIntent[];
  readonly profiles: readonly ArchiProfileCreateIntent[];
  readonly relations: readonly ArchiRelationshipCreateIntent[];
  readonly predefinedFolderIds: Readonly<Record<PredefinedFolderKey, string>>;
}

export function serializeArchiSnapshot(snapshot: ArchiModelSnapshot): SerializableArchiSnapshot {
  const predefinedFolderIds = {} as Record<PredefinedFolderKey, string>;
  for (const def of PREDEFINED_FOLDERS) {
    predefinedFolderIds[def.key] = snapshot.getPredefinedFolderId(def.key);
  }

  return {
    folders: snapshot.listFolders(),
    elements: snapshot.listElements(),
    profiles: snapshot.listProfiles(),
    relations: snapshot.listRelations(),
    predefinedFolderIds,
  };
}

export function deserializeArchiSnapshot(data: SerializableArchiSnapshot): ArchiModelSnapshot {
  return createArchiModelSnapshot(data);
}
