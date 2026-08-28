import { writeFileSync } from "node:fs";
import path from "node:path";
import { packageVersion } from "../package-version.js";
import { formatIso8601WithOffset } from "../platform/timestamp.js";
import { getLogger } from "../platform/logging/index.js";
import type { EntityType } from "./entities/entity-types.js";
import type { RunEntityStore } from "./run-entity-store.js";

export const REPOSITORY_SCHEMA_ID =
  "https://code2archi.dev/specifications/discovery-model/schemas/Repository.schema.json";

export const APPLICATION_MODULE_SCHEMA_ID =
  "https://code2archi.dev/specifications/discovery-model/schemas/ApplicationModule.schema.json";

export const APPLICATION_MODULE_DEPENDENCY_SCHEMA_ID =
  "https://code2archi.dev/specifications/discovery-model/schemas/ApplicationModuleDependency.schema.json";

interface ManifestCollectionEntry {
  readonly path: string;
  readonly contentType: "entities" | "many-to-many";
  readonly entityType?: string;
  readonly schema?: string;
  readonly fromEntityType?: string;
  readonly toEntityType?: string;
  readonly fromIdField?: string;
  readonly toIdField?: string;
}

interface Manifest {
  readonly formatVersion: string;
  readonly scanId?: string;
  readonly scannedAt?: string;
  readonly runConfigPath?: string;
  readonly sourceRoot?: string;
  readonly collections: readonly ManifestCollectionEntry[];
}

interface EntityCollectionDef {
  readonly collectionPath: string;
  readonly schemaId?: string;
}

/** Mirror of documentation/specifications/discovery-model/entity-types.md */
const ENTITY_COLLECTION_REGISTRY: Record<EntityType, EntityCollectionDef> = {
  Repository: {
    collectionPath: "repositories.json",
    schemaId: REPOSITORY_SCHEMA_ID,
  },
  BuildScript: { collectionPath: "build-scripts.json" },
  RuntimeEnvironment: { collectionPath: "runtime-environments.json" },
  ApplicationModule: {
    collectionPath: "application-modules.json",
    schemaId: APPLICATION_MODULE_SCHEMA_ID,
  },
  ApplicationModuleDependency: {
    collectionPath: "application-module-dependencies.json",
    schemaId: APPLICATION_MODULE_DEPENDENCY_SCHEMA_ID,
  },
  RestController: { collectionPath: "rest-controllers.json" },
  RestClient: { collectionPath: "rest-clients.json" },
  MessageConsumer: { collectionPath: "message-consumers.json" },
  MessageProducer: { collectionPath: "message-producers.json" },
};

function getEntityCollectionDef(entityType: EntityType): EntityCollectionDef {
  return ENTITY_COLLECTION_REGISTRY[entityType];
}

export interface DiscoveryModelWriteInput {
  readonly outputDir: string;
  readonly store: RunEntityStore;
  readonly scannedAt: Date;
}

export class DiscoveryModelWriter {
  write(input: DiscoveryModelWriteInput): void {
    const logger = getLogger("scan.writer");
    logger.info("writing discovery-model", { path: input.outputDir });

    const collections: NonNullable<Manifest["collections"]>[number][] = [];

    for (const entityType of input.store.listNonemptyEntityTypes()) {
      const def = getEntityCollectionDef(entityType);
      if (!def.schemaId) {
        continue;
      }

      const entities = input.store.getEntities(entityType);
      writeFileSync(
        path.join(input.outputDir, def.collectionPath),
        `${JSON.stringify(entities, null, 2)}\n`,
        "utf8",
      );

      collections.push({
        path: def.collectionPath,
        contentType: "entities",
        entityType,
        schema: def.schemaId,
      });
    }

    const manifest: Manifest = {
      formatVersion: packageVersion,
      scanId: input.store.scanId,
      scannedAt: formatIso8601WithOffset(input.scannedAt),
      sourceRoot: input.store.sourceRoot,
      collections,
    };

    writeFileSync(
      path.join(input.outputDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );

    logger.info("discovery-model written", {
      path: input.outputDir,
      collectionCount: collections.length,
    });
  }
}
