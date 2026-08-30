import path from "node:path";
import type { BuiltInProcessorGroupId } from "../cli/processor-groups.js";
import { resolveBuiltInGroupId } from "../platform/processors/processor-coordinate.js";
import { packageVersion } from "../package-version.js";
import { formatIso8601WithOffset } from "../platform/timestamp.js";
import type { ProcessorId } from "../platform/processors/processor.js";
import { buildDiscoveryModelSnapshot } from "./discovery-model-snapshot.js";
import type { DiscoveryModelSnapshot } from "./discovery-model-snapshot.js";
import type { CreateIntents } from "./entities/create-intents.js";
import type { CreateIntentRecord } from "./entities/create-intents.js";
import type { DiscoveryEntityCreateIntent } from "./entities/entity-base.js";
import { Entity } from "./entities/entity.js";
import type { DiscoveryEntityRecord, EntityType } from "./entities/entity-types.js";
import { ENTITY_TYPES } from "./entities/entity-types.js";

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
  "scan.source": [
    "BuildScript",
    "RuntimeEnvironment",
    "ApplicationModule",
    "ApplicationModuleDependency",
    "RestController",
    "RestClient",
    "MessageConsumer",
    "MessageProducer",
  ],
};

function isEntityTypeAllowedForGroup(
  builtInGroupId: BuiltInProcessorGroupId,
  entityType: EntityType,
): boolean {
  return (GROUP_ENTITY_ALLOWLIST[builtInGroupId] ?? []).includes(entityType);
}

function formatScannerExtractor(processorId: ProcessorId): string {
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
    scannerExtractor: formatScannerExtractor(processorId),
    scannerSchema: packageVersion,
    extractedAt: formatIso8601WithOffset(extractedAt),
  };
}

function toDiscoveryEntityCreateIntent(
  record: CreateIntentRecord,
): DiscoveryEntityCreateIntent {
  if (record instanceof Entity) {
    return record.toCreateIntent();
  }

  return record;
}

export class RunEntityStore {
  private readonly entities = new Map<EntityType, Map<string, DiscoveryEntityRecord>>();
  private readonly globalIds = new Set<string>();
  private readonly sourceDirs: readonly string[];
  readonly scanId: string;
  readonly runStartedAt: Date;

  constructor(init: RunEntityStoreInit) {
    this.sourceDirs = init.sourceDirs;
    this.scanId = init.scanId;
    this.runStartedAt = init.runStartedAt;
  }

  get sourceRoot(): string {
    return RunEntityStore.computeSourceRoot(this.sourceDirs);
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
      for (const linkType of Object.keys(intents.links)) {
        throw new Error(
          `Link create-intents are not supported yet (linkType: ${linkType})`,
        );
      }
    }
  }

  snapshot(): DiscoveryModelSnapshot {
    return buildDiscoveryModelSnapshot({
      scanId: this.scanId,
      sourceRoot: this.sourceRoot,
      runStartedAt: this.runStartedAt,
      entityMaps: this.entities,
    });
  }

  listNonemptyEntityTypes(): EntityType[] {
    return ENTITY_TYPES.filter((entityType) => {
      const bucket = this.entities.get(entityType);
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
