import type { EntityType } from "./entities/entity-types.js";

/** Mirror of documentation/specifications/discovery-model/entity-types.md § ref-index fields */
export const ENTITY_REF_INDEX_FIELDS: Partial<Record<EntityType, readonly string[]>> = {
  ApplicationModule: ["repositoryId", "parentId"],
  ApplicationModuleDependency: ["parentId"],
  RestController: ["applicationModuleId"],
  RestClient: ["applicationModuleId"],
};
