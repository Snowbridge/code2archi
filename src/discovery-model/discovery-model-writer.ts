import { writeFileSync } from "node:fs";
import path from "node:path";
import { packageVersion } from "../package-version.js";
import { formatIso8601WithOffset } from "../platform/timestamp.js";
import { getLogger } from "../platform/logging/index.js";
import type { EntityType } from "./entities/entity-types.js";
import type { LinkType } from "./links/link-types.js";
import type { RunEntityStore } from "./run-entity-store.js";

export const REPOSITORY_SCHEMA_ID =
  "https://code2archi.dev/specifications/discovery-model/schemas/Repository.schema.json";

export const APPLICATION_MODULE_SCHEMA_ID =
  "https://code2archi.dev/specifications/discovery-model/schemas/ApplicationModule.schema.json";

export const APPLICATION_MODULE_DEPENDENCY_SCHEMA_ID =
  "https://code2archi.dev/specifications/discovery-model/schemas/ApplicationModuleDependency.schema.json";

export const REST_CONTROLLER_SCHEMA_ID =
  "https://code2archi.dev/specifications/discovery-model/schemas/RestController.schema.json";

export const REST_CLIENT_SCHEMA_ID =
  "https://code2archi.dev/specifications/discovery-model/schemas/RestClient.schema.json";

export const DIRECT_REST_REQUESTS_SERVING_MATCH_SCHEMA_ID =
  "https://code2archi.dev/specifications/discovery-model/schemas/DirectRestRequestsServingMatch.schema.json";

export const NODEJS_REST_CONTROLLER_SCHEMA_ID =
  "https://code2archi.dev/specifications/discovery-model/schemas/NodejsRestController.schema.json";

export const NODEJS_REST_CLIENT_SCHEMA_ID =
  "https://code2archi.dev/specifications/discovery-model/schemas/NodejsRestClient.schema.json";

export const NODEJS_DIRECT_REST_REQUESTS_SERVING_MATCH_SCHEMA_ID =
  "https://code2archi.dev/specifications/discovery-model/schemas/NodejsDirectRestRequestsServingMatch.schema.json";

interface ManifestCollectionEntry {
  readonly path: string;
  readonly contentType: "entities" | "many-to-many";
  readonly entityType?: string;
  readonly linkType?: string;
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

interface LinkCollectionDef {
  readonly collectionPath: string;
  readonly schemaId: string;
  readonly fromEntityType: string;
  readonly toEntityType: string;
  readonly fromIdField: string;
  readonly toIdField: string;
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
  RestController: {
    collectionPath: "rest-controllers.json",
    schemaId: REST_CONTROLLER_SCHEMA_ID,
  },
  RestClient: {
    collectionPath: "rest-clients.json",
    schemaId: REST_CLIENT_SCHEMA_ID,
  },
  NodejsRestController: {
    collectionPath: "nodejs-rest-controllers.json",
    schemaId: NODEJS_REST_CONTROLLER_SCHEMA_ID,
  },
  NodejsRestClient: {
    collectionPath: "nodejs-rest-clients.json",
    schemaId: NODEJS_REST_CLIENT_SCHEMA_ID,
  },
  MessageConsumer: { collectionPath: "message-consumers.json" },
  MessageProducer: { collectionPath: "message-producers.json" },
};

const LINK_COLLECTION_REGISTRY: Record<LinkType, LinkCollectionDef> = {
  DirectRestRequestsServingMatch: {
    collectionPath: "direct-rest-requests-serving-matches.json",
    schemaId: DIRECT_REST_REQUESTS_SERVING_MATCH_SCHEMA_ID,
    fromEntityType: "RestController",
    toEntityType: "RestClient",
    fromIdField: "restControllerId",
    toIdField: "restClientId",
  },
  NodejsDirectRestRequestsServingMatch: {
    collectionPath: "nodejs-direct-rest-requests-serving-matches.json",
    schemaId: NODEJS_DIRECT_REST_REQUESTS_SERVING_MATCH_SCHEMA_ID,
    fromEntityType: "NodejsRestController",
    toEntityType: "NodejsRestClient",
    fromIdField: "nodejsRestControllerId",
    toIdField: "nodejsRestClientId",
  },
};

function getEntityCollectionDef(entityType: EntityType): EntityCollectionDef {
  return ENTITY_COLLECTION_REGISTRY[entityType];
}

function getLinkCollectionDef(linkType: LinkType): LinkCollectionDef {
  return LINK_COLLECTION_REGISTRY[linkType];
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

    for (const linkType of input.store.listNonemptyLinkTypes()) {
      const def = getLinkCollectionDef(linkType);
      const links = input.store.getLinks(linkType);
      writeFileSync(
        path.join(input.outputDir, def.collectionPath),
        `${JSON.stringify(links, null, 2)}\n`,
        "utf8",
      );

      collections.push({
        path: def.collectionPath,
        contentType: "many-to-many",
        linkType,
        schema: def.schemaId,
        fromEntityType: def.fromEntityType,
        toEntityType: def.toEntityType,
        fromIdField: def.fromIdField,
        toIdField: def.toIdField,
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
