import path from "node:path";
import type { BuiltInProcessorGroupId } from "../cli/processor-groups.js";
import { resolveBuiltInGroupId } from "../platform/processors/processor-coordinate.js";
import { packageVersion } from "../package-version.js";
import { formatIso8601WithOffset } from "../platform/timestamp.js";
import type { ProcessorId } from "../platform/processors/processor.js";
import {
  computeRepositoryCommonRoot,
  computeRepositoryNamespace,
} from "../scan/repository-discovery-root.js";
import { buildDiscoveryModelSnapshot } from "./discovery-model-snapshot.js";
import type { DiscoveryModelSnapshot } from "./discovery-model-snapshot.js";
import type { CreateIntents, LinkCreateIntentRecord } from "./entities/create-intents.js";
import type { CreateIntentRecord } from "./entities/create-intents.js";
import type { DiscoveryEntityCreateIntent } from "./entities/entity-base.js";
import { Entity } from "./entities/entity.js";
import type { DiscoveryEntityRecord, EntityType } from "./entities/entity-types.js";
import { ENTITY_TYPES } from "./entities/entity-types.js";
import type { DiscoveryLinkCreateIntent } from "./links/link-base.js";
import { Link } from "./links/link.js";
import type { DiscoveryLinkRecord } from "./links/link-records.js";
import type { LinkType } from "./links/link-types.js";
import { LINK_TYPES } from "./links/link-types.js";

export type { DiscoveryModelSnapshot } from "./discovery-model-snapshot.js";

export interface RunEntityStoreInit {
  readonly sourceDirs: readonly string[];
  readonly scanId: string;
  readonly runStartedAt: Date;
}

/** Mirror of documentation/specifications/discovery-model/entity-types.md */
export const GROUP_ENTITY_ALLOWLIST: Partial<
  Record<BuiltInProcessorGroupId, readonly EntityType[]>
> = {
  "scan.scope": ["Repository"],
  "scan.extract": [
    "BuildScript",
    "RuntimeEnvironment",
    "ApplicationModule",
    "ApplicationModuleDependency",
    "RestController",
    "RestClient",
    "NodejsRestController",
    "NodejsRestClient",
    "MessageConsumer",
    "MessageProducer",
  ],
};

/** Mirror of documentation/specifications/discovery-model/entity-types.md § link types */
export const GROUP_LINK_ALLOWLIST: Partial<
  Record<BuiltInProcessorGroupId, readonly LinkType[]>
> = {
  "scan.transform": ["RestClientToControllerLink", "NodejsDirectRestRequestsServingMatch"],
};

function isEntityTypeAllowedForGroup(
  builtInGroupId: BuiltInProcessorGroupId,
  entityType: EntityType,
): boolean {
  return (GROUP_ENTITY_ALLOWLIST[builtInGroupId] ?? []).includes(entityType);
}

function isLinkTypeAllowedForGroup(
  builtInGroupId: BuiltInProcessorGroupId,
  linkType: LinkType,
): boolean {
  return (GROUP_LINK_ALLOWLIST[builtInGroupId] ?? []).includes(linkType);
}

function formatProcessorCoordinate(processorId: ProcessorId): string {
  return `${processorId.groupId}:${processorId.artifactId}`;
}

function enrichDiscoveryEntity(
  record: DiscoveryEntityCreateIntent,
  processorId: ProcessorId,
  extractedAt: Date = new Date(),
): DiscoveryEntityRecord {
  if (!record.id) {
    throw new Error("Entity create-intent is missing id");
  }

  return {
    ...record,
    id: record.id,
    extractProcessor: formatProcessorCoordinate(processorId),
    extractSchema: packageVersion,
    extractedAt: formatIso8601WithOffset(extractedAt),
  };
}

function enrichDiscoveryLink(
  record: DiscoveryLinkCreateIntent,
  processorId: ProcessorId,
  linkedAt: Date = new Date(),
): DiscoveryLinkRecord {
  if (!record.id) {
    throw new Error("Link create-intent is missing id");
  }

  return {
    ...record,
    id: record.id,
    transformProcessor: formatProcessorCoordinate(processorId),
    transformSchema: packageVersion,
    linkedAt: formatIso8601WithOffset(linkedAt),
  } as DiscoveryLinkRecord;
}

function toDiscoveryEntityCreateIntent(
  record: CreateIntentRecord,
): DiscoveryEntityCreateIntent {
  if (record instanceof Entity) {
    return record.toCreateIntent();
  }

  return record;
}

function toDiscoveryLinkCreateIntent(record: LinkCreateIntentRecord): DiscoveryLinkCreateIntent {
  if (record instanceof Link) {
    return record.toCreateIntent();
  }

  return record;
}

export class RunEntityStore {
  private readonly entities = new Map<EntityType, Map<string, DiscoveryEntityRecord>>();
  private readonly links = new Map<LinkType, Map<string, DiscoveryLinkRecord>>();
  private readonly globalIds = new Set<string>();
  private readonly sourceDirs: readonly string[];
  private repositoryCommonRoot = "";
  readonly scanId: string;
  readonly runStartedAt: Date;

  constructor(init: RunEntityStoreInit) {
    this.sourceDirs = init.sourceDirs.map((sourceDir) => path.resolve(sourceDir));
    this.scanId = init.scanId;
    this.runStartedAt = init.runStartedAt;
  }

  get resolvedSourceDirs(): readonly string[] {
    return this.sourceDirs;
  }

  get sourceRoot(): string {
    return RunEntityStore.computeSourceRoot(this.sourceDirs);
  }

  finalizeRepositoryNamespaces(): string {
    const repositories = this.getEntities("Repository");
    const localPaths = repositories.map((repository) => String(repository.localPath));
    this.repositoryCommonRoot = computeRepositoryCommonRoot(localPaths);

    const bucket = this.entities.get("Repository");
    if (!bucket) {
      return this.repositoryCommonRoot;
    }

    for (const repository of repositories) {
      const namespace = computeRepositoryNamespace(
        this.repositoryCommonRoot,
        String(repository.localPath),
      );
      bucket.set(repository.id, {
        ...repository,
        namespace,
      });
    }

    return this.repositoryCommonRoot;
  }

  addCreateIntents(
    builtInGroupId: BuiltInProcessorGroupId,
    processorId: ProcessorId,
    intents: CreateIntents,
    extractedAt: Date = new Date(),
  ): void {
    const processorBuiltInGroupId = resolveBuiltInGroupId(processorId.groupId);
    if (processorBuiltInGroupId !== builtInGroupId) {
      throw new Error(
        `Processor groupId mismatch: expected built-in group ${builtInGroupId}, got ${processorId.groupId}`,
      );
    }

    if (intents.entities) {
      for (const [entityTypeKey, records] of Object.entries(intents.entities)) {
        if (!records || records.length === 0) {
          continue;
        }

        const entityType = entityTypeKey as EntityType;
        if (!isEntityTypeAllowedForGroup(builtInGroupId, entityType)) {
          throw new Error(
            `Entity type ${entityType} is not allowed for processor group ${builtInGroupId}`,
          );
        }

        for (const record of records) {
          this.addEntity(
            entityType,
            enrichDiscoveryEntity(
              toDiscoveryEntityCreateIntent(record),
              processorId,
              extractedAt,
            ),
          );
        }
      }
    }

    if (intents.links) {
      for (const [linkTypeKey, records] of Object.entries(intents.links)) {
        if (!records || records.length === 0) {
          continue;
        }

        const linkType = linkTypeKey as LinkType;
        if (!isLinkTypeAllowedForGroup(builtInGroupId, linkType)) {
          throw new Error(
            `Link type ${linkType} is not allowed for processor group ${builtInGroupId}`,
          );
        }

        for (const record of records) {
          this.addLink(
            linkType,
            enrichDiscoveryLink(toDiscoveryLinkCreateIntent(record), processorId, extractedAt),
          );
        }
      }
    }
  }

  snapshot(): DiscoveryModelSnapshot {
    return buildDiscoveryModelSnapshot({
      scanId: this.scanId,
      sourceRoot: this.sourceRoot,
      sourceDirs: this.sourceDirs,
      repositoryCommonRoot: this.repositoryCommonRoot,
      runStartedAt: this.runStartedAt,
      entityMaps: this.entities,
      linkMaps: this.links,
    });
  }

  listNonemptyEntityTypes(): EntityType[] {
    return ENTITY_TYPES.filter((entityType) => {
      const bucket = this.entities.get(entityType);
      return bucket !== undefined && bucket.size > 0;
    });
  }

  listNonemptyLinkTypes(): LinkType[] {
    return LINK_TYPES.filter((linkType) => {
      const bucket = this.links.get(linkType);
      return bucket !== undefined && bucket.size > 0;
    });
  }

  getEntities(entityType: EntityType): readonly DiscoveryEntityRecord[] {
    const bucket = this.entities.get(entityType);
    if (!bucket || bucket.size === 0) {
      return [];
    }

    return [...bucket.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  getLinks(linkType: LinkType): readonly DiscoveryLinkRecord[] {
    const bucket = this.links.get(linkType);
    if (!bucket || bucket.size === 0) {
      return [];
    }

    return [...bucket.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  private addEntity(entityType: EntityType, record: DiscoveryEntityRecord): void {
    if (!record.id) {
      throw new Error(`Entity record of type ${entityType} is missing id`);
    }

    if (this.globalIds.has(record.id)) {
      throw new Error(`Duplicate id: ${record.id} (entityType: ${entityType})`);
    }

    let bucket = this.entities.get(entityType);
    if (!bucket) {
      bucket = new Map();
      this.entities.set(entityType, bucket);
    }

    if (bucket.has(record.id)) {
      throw new Error(`Duplicate ${entityType} id: ${record.id}`);
    }

    this.globalIds.add(record.id);
    bucket.set(record.id, record);
  }

  private addLink(linkType: LinkType, record: DiscoveryLinkRecord): void {
    if (!record.id) {
      throw new Error(`Link record of type ${linkType} is missing id`);
    }

    if (this.globalIds.has(record.id)) {
      throw new Error(`Duplicate id: ${record.id} (linkType: ${linkType})`);
    }

    let bucket = this.links.get(linkType);
    if (!bucket) {
      bucket = new Map();
      this.links.set(linkType, bucket);
    }

    if (bucket.has(record.id)) {
      throw new Error(`Duplicate ${linkType} id: ${record.id}`);
    }

    this.globalIds.add(record.id);
    bucket.set(record.id, record);
  }

  private static computeSourceRoot(sourceDirs: readonly string[]): string {
    if (sourceDirs.length === 0) {
      return "";
    }

    if (sourceDirs.length === 1) {
      return path.resolve(sourceDirs[0]!);
    }

    let prefix = path.resolve(sourceDirs[0]!);
    for (const sourceDir of sourceDirs.slice(1)) {
      const resolved = path.resolve(sourceDir);
      while (
        prefix !== resolved &&
        !resolved.startsWith(prefix + path.sep) &&
        prefix !== path.parse(prefix).root
      ) {
        prefix = path.dirname(prefix);
      }
      if (prefix === path.parse(prefix).root) {
        return prefix;
      }
    }

    return prefix;
  }
}
