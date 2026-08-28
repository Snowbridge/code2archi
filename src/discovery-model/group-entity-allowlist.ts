import type { ProcessorGroupId } from "../cli/processor-groups.js";
import type { EntityType } from "./entity-types.js";

/** Mirror of documentation/specifications/discovery-model/entity-types.md */
const GROUP_ENTITY_ALLOWLIST: Partial<Record<ProcessorGroupId, readonly EntityType[]>> = {
  "scan-scope": ["Repository"],
  "scan-tech": ["BuildScript", "RuntimeEnvironment"],
  "scan-app": [
    "ApplicationModule",
    "ApplicationModuleDependency",
    "RestController",
    "RestClient",
    "MessageConsumer",
    "MessageProducer",
  ],
};

export function allowedEntityTypes(groupId: ProcessorGroupId): readonly EntityType[] {
  return GROUP_ENTITY_ALLOWLIST[groupId] ?? [];
}

export function isEntityTypeAllowedForGroup(
  groupId: ProcessorGroupId,
  entityType: EntityType,
): boolean {
  return allowedEntityTypes(groupId).includes(entityType);
}

/** Exported for tests mirroring the spec matrix. */
export function groupEntityAllowlistForTests(): typeof GROUP_ENTITY_ALLOWLIST {
  return GROUP_ENTITY_ALLOWLIST;
}
