import path from "node:path";
import type { ProcessorGroupId } from "../cli/processor-groups.js";
import type { CreateIntents } from "./create-intents.js";
import { enrichDiscoveryEntity } from "./enrich-discovery-entity.js";
import {
  type DiscoveryModelSnapshot,
  deepFreeze,
} from "./discovery-model-snapshot.js";
import type { DiscoveryEntityRecord, EntityType } from "./entity-types.js";
import { ENTITY_TYPES } from "./entity-types.js";
import { isEntityTypeAllowedForGroup } from "./group-entity-allowlist.js";
import type { ProcessorId } from "../platform/processors/processor-id.js";

export interface RunEntityStoreInit {
  readonly sourceDirs: readonly string[];
  readonly scanId: string;
  readonly runStartedAt: Date;
}

class FrozenDiscoveryModelSnapshot implements DiscoveryModelSnapshot {
  constructor(
    readonly scanId: string,
    readonly sourceRoot: string,
    readonly runStartedAt: Date,
    private readonly entities: Readonly<
      Partial<Record<EntityType, readonly DiscoveryEntityRecord[]>>
    >,
  ) {}

  listEntities(entityType: EntityType): readonly DiscoveryEntityRecord[] {
    return this.entities[entityType] ?? [];
  }

  getEntity(entityType: EntityType, id: string): DiscoveryEntityRecord | undefined {
    return this.listEntities(entityType).find((entity) => entity.id === id);
  }
}

export class RunEntityStore {
  private readonly entities = new Map<EntityType, Map<string, DiscoveryEntityRecord>>();
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
    groupId: ProcessorGroupId,
    processorId: ProcessorId,
    intents: CreateIntents,
    extractedAt: Date = new Date(),
  ): void {
    if (processorId.groupId !== groupId) {
      throw new Error(
        `Processor groupId mismatch: expected ${groupId}, got ${processorId.groupId}`,
      );
    }

    if (intents.entities) {
      for (const [entityTypeKey, records] of Object.entries(intents.entities)) {
        if (!records || records.length === 0) {
          continue;
        }

        const entityType = entityTypeKey as EntityType;
        if (!isEntityTypeAllowedForGroup(groupId, entityType)) {
          throw new Error(
            `Entity type ${entityType} is not allowed for processor group ${groupId}`,
          );
        }

        for (const record of records) {
          this.addEntity(
            entityType,
            enrichDiscoveryEntity(record, processorId, extractedAt),
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
    const entities: Partial<Record<EntityType, readonly DiscoveryEntityRecord[]>> = {};

    for (const entityType of ENTITY_TYPES) {
      const bucket = this.entities.get(entityType);
      if (!bucket || bucket.size === 0) {
        continue;
      }

      entities[entityType] = deepFreeze(
        [...bucket.values()].sort((a, b) => a.id.localeCompare(b.id)),
      );
    }

    return deepFreeze(
      new FrozenDiscoveryModelSnapshot(
        this.scanId,
        this.sourceRoot,
        this.runStartedAt,
        deepFreeze(entities),
      ),
    );
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

    let bucket = this.entities.get(entityType);
    if (!bucket) {
      bucket = new Map();
      this.entities.set(entityType, bucket);
    }

    if (bucket.has(record.id)) {
      throw new Error(`Duplicate ${entityType} id: ${record.id}`);
    }

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
