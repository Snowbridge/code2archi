import {
  createArchiModelSnapshot,
  type ArchiModelSnapshot,
} from "../../archimate-model/archi-model-store.js";
import { PREDEFINED_FOLDERS, type PredefinedFolderKey } from "../../archimate-model/concept-types.js";
import type { ArchiElementCreateIntent } from "../../archimate-model/elements/archi-element.js";
import type { ArchiFolder } from "../../archimate-model/folders/archi-folder.js";
import type { ArchiProfileCreateIntent } from "../../archimate-model/profiles/profile.js";
import type { ArchiRelationshipCreateIntent } from "../../archimate-model/relationships/archi-relationship.js";
import { buildDiscoveryModelSnapshot } from "../../discovery-model/discovery-model-snapshot.js";
import type { DiscoveryModelSnapshot } from "../../discovery-model/run-entity-store.js";
import type { DiscoveryEntityRecord, EntityType } from "../../discovery-model/entities/entity-types.js";
import { ENTITY_TYPES } from "../../discovery-model/entities/entity-types.js";
import type { DiscoveryLinkRecord } from "../../discovery-model/links/link-records.js";
import type { LinkType } from "../../discovery-model/links/link-types.js";
import { LINK_TYPES } from "../../discovery-model/links/link-types.js";

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
  snapshot: DiscoveryModelSnapshot,
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
      links[linkType] = records;
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
): DiscoveryModelSnapshot {
  return buildDiscoveryModelSnapshot({
    scanId: data.scanId,
    sourceRoot: data.sourceRoot,
    sourceDirs: data.sourceDirs,
    repositoryCommonRoot: data.repositoryCommonRoot,
    runStartedAt: new Date(data.runStartedAt),
    entityArrays: data.entities,
    linkArrays: data.links,
  });
}

export function filterSerializableDiscoverySnapshotToRepository(
  data: SerializableDiscoverySnapshot,
  repositoryId: string,
): SerializableDiscoverySnapshot {
  const repositories = data.entities.Repository ?? [];
  const repository = repositories.find((record) => record.id === repositoryId);
  if (!repository) {
    throw new Error(`Repository not found in snapshot: ${repositoryId}`);
  }

  return {
    ...data,
    entities: {
      ...data.entities,
      Repository: [repository],
    },
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
