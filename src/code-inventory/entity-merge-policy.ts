import type { EntityType } from "./entities/entity-types.js";
import {
  REST_CONTROLLER_MERGE_ARRAY_FIELDS,
  REST_CONTROLLER_SCALAR_FIELDS,
} from "./entities/rest-controller.js";
import type { DiscoveryEntityRecord } from "./entities/entity-types.js";
import { getLogger } from "../platform/logging/index.js";

export type EntityDuplicatePolicy = "error" | "skip" | "merge";

/** Mirror of ADR-26090803 and platform/processors.md */
export const ENTITY_DUPLICATE_POLICIES: Partial<Record<EntityType, EntityDuplicatePolicy>> = {
  HttpApiDataType: "skip",
  HttpApiContract: "skip",
  RestController: "merge",
};

export function resolveEntityDuplicatePolicy(entityType: EntityType): EntityDuplicatePolicy {
  return ENTITY_DUPLICATE_POLICIES[entityType] ?? "error";
}

function unionStringArrays(
  left: readonly string[],
  right: readonly string[],
): string[] {
  return [...new Set([...left, ...right])].sort((a, b) => a.localeCompare(b));
}

function mergeRestController(
  existing: DiscoveryEntityRecord,
  incoming: DiscoveryEntityRecord,
): DiscoveryEntityRecord {
  const logger = getLogger("discovery.entityStore");
  const merged: Record<string, unknown> = { ...existing };

  for (const field of REST_CONTROLLER_SCALAR_FIELDS) {
    const existingValue = existing[field];
    const incomingValue = incoming[field];
    if (
      existingValue !== undefined &&
      incomingValue !== undefined &&
      existingValue !== incomingValue
    ) {
      logger.warn("RestController scalar mismatch on merge; keeping first value", {
        id: existing.id,
        field,
        existingValue,
        incomingValue,
      });
    }
    if (merged[field] === undefined && incomingValue !== undefined) {
      merged[field] = incomingValue;
    }
  }

  for (const field of REST_CONTROLLER_MERGE_ARRAY_FIELDS) {
    const existingArray = Array.isArray(existing[field])
      ? (existing[field] as string[])
      : [];
    const incomingArray = Array.isArray(incoming[field])
      ? (incoming[field] as string[])
      : [];
    merged[field] = unionStringArrays(existingArray, incomingArray);
  }

  return merged as DiscoveryEntityRecord;
}

export function mergeDuplicateEntity(
  entityType: EntityType,
  existing: DiscoveryEntityRecord,
  incoming: DiscoveryEntityRecord,
): DiscoveryEntityRecord {
  if (entityType === "RestController") {
    return mergeRestController(existing, incoming);
  }

  return existing;
}

export function logSkippedDuplicateEntity(
  entityType: EntityType,
  id: string,
  processorCoordinate: string,
): void {
  getLogger("discovery.entityStore").warn("Skipping duplicate entity create-intent", {
    entityType,
    id,
    processor: processorCoordinate,
  });
}
