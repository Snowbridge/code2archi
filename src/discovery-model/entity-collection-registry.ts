import type { EntityType } from "./entity-types.js";
import {
  APPLICATION_MODULE_DEPENDENCY_SCHEMA_ID,
  APPLICATION_MODULE_SCHEMA_ID,
  REPOSITORY_SCHEMA_ID,
} from "./schema-ids.js";

export interface EntityCollectionDef {
  readonly collectionPath: string;
  readonly schemaId?: string;
}

/** Mirror of documentation/specifications/discovery-model/entity-types.md */
export const ENTITY_COLLECTION_REGISTRY: Record<EntityType, EntityCollectionDef> = {
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

export function getEntityCollectionDef(entityType: EntityType): EntityCollectionDef {
  return ENTITY_COLLECTION_REGISTRY[entityType];
}
