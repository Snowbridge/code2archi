import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { DiscoveryModelSnapshot } from "./run-entity-store.js";
import type { DiscoveryEntityRecord, EntityType } from "./entities/entity-types.js";
import { ENTITY_TYPES } from "./entities/entity-types.js";

interface ManifestCollectionEntry {
  readonly path: string;
  readonly contentType: "entities" | "many-to-many";
  readonly entityType?: string;
}

interface Manifest {
  readonly formatVersion?: string;
  readonly scanId?: string;
  readonly scannedAt?: string;
  readonly sourceRoot?: string;
  readonly collections?: readonly ManifestCollectionEntry[];
}

class LoadedDiscoveryModelSnapshot implements DiscoveryModelSnapshot {
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

function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

export class DiscoveryModelReader {
  read(inputDir: string): DiscoveryModelSnapshot {
    const manifestPath = path.join(inputDir, "manifest.json");
    if (!existsSync(manifestPath)) {
      throw new Error(`Discovery-model manifest not found: ${manifestPath}`);
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
    const entities: Partial<Record<EntityType, DiscoveryEntityRecord[]>> = {};

    for (const collection of manifest.collections ?? []) {
      if (collection.contentType !== "entities" || !collection.entityType) {
        continue;
      }

      if (!isEntityType(collection.entityType)) {
        continue;
      }

      const collectionPath = path.join(inputDir, collection.path);
      if (!existsSync(collectionPath)) {
        continue;
      }

      const parsed = JSON.parse(readFileSync(collectionPath, "utf8")) as DiscoveryEntityRecord[];
      if (!Array.isArray(parsed)) {
        throw new Error(`Invalid entity collection (expected array): ${collection.path}`);
      }

      entities[collection.entityType] = parsed;
    }

    const runStartedAt = manifest.scannedAt ? new Date(manifest.scannedAt) : new Date();

    return new LoadedDiscoveryModelSnapshot(
      manifest.scanId ?? path.basename(inputDir),
      manifest.sourceRoot ?? inputDir,
      Number.isNaN(runStartedAt.getTime()) ? new Date() : runStartedAt,
      entities,
    );
  }
}
