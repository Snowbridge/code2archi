import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildDiscoveryModelSnapshot } from "./discovery-model-snapshot.js";
import type { DiscoveryModelSnapshot } from "./discovery-model-snapshot.js";
import type { DiscoveryEntityRecord, EntityType } from "./entities/entity-types.js";
import { ENTITY_TYPES } from "./entities/entity-types.js";
import type { DiscoveryLinkRecord } from "./links/link-records.js";
import { isLinkType } from "./links/link-records.js";
import type { LinkType } from "./links/link-types.js";

interface ManifestCollectionEntry {
  readonly path: string;
  readonly contentType: "entities" | "many-to-many";
  readonly entityType?: string;
  readonly linkType?: string;
}

interface Manifest {
  readonly formatVersion?: string;
  readonly scanId?: string;
  readonly scannedAt?: string;
  readonly sourceRoot?: string;
  readonly collections?: readonly ManifestCollectionEntry[];
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
    const links: Partial<Record<LinkType, DiscoveryLinkRecord[]>> = {};

    for (const collection of manifest.collections ?? []) {
      const collectionPath = path.join(inputDir, collection.path);
      if (!existsSync(collectionPath)) {
        continue;
      }

      const parsed = JSON.parse(readFileSync(collectionPath, "utf8")) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error(`Invalid collection (expected array): ${collection.path}`);
      }

      if (collection.contentType === "entities" && collection.entityType) {
        if (!isEntityType(collection.entityType)) {
          continue;
        }

        entities[collection.entityType] = parsed as DiscoveryEntityRecord[];
        continue;
      }

      if (collection.contentType === "many-to-many" && collection.linkType) {
        if (!isLinkType(collection.linkType)) {
          continue;
        }

        links[collection.linkType] = parsed as DiscoveryLinkRecord[];
      }
    }

    const runStartedAt = manifest.scannedAt ? new Date(manifest.scannedAt) : new Date();

    return buildDiscoveryModelSnapshot({
      scanId: manifest.scanId ?? path.basename(inputDir),
      sourceRoot: manifest.sourceRoot ?? inputDir,
      runStartedAt: Number.isNaN(runStartedAt.getTime()) ? new Date() : runStartedAt,
      entityArrays: entities,
      linkArrays: links,
    });
  }
}
