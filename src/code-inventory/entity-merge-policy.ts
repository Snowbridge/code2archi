import type { EntityType } from "./entities/entity-types.js";
import {
  REST_CLIENT_MERGE_ARRAY_FIELDS,
  REST_CLIENT_SCALAR_FIELDS,
} from "./entities/rest-client.js";
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
  RestClient: "merge",
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

function mergeRestEndpointEntity(
  entityType: "RestController" | "RestClient",
  existing: DiscoveryEntityRecord,
  incoming: DiscoveryEntityRecord,
  scalarFields: readonly string[],
  arrayFields: readonly string[],
): DiscoveryEntityRecord {
  const logger = getLogger("discovery.entityStore");
  const merged: Record<string, unknown> = { ...existing };

  for (const field of scalarFields) {
    const existingValue = existing[field];
    const incomingValue = incoming[field];
    if (
      existingValue !== undefined &&
      incomingValue !== undefined &&
      existingValue !== incomingValue
    ) {
      logger.warn(`${entityType} scalar mismatch on merge; keeping first value`, {
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

  for (const field of arrayFields) {
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

function mergeRestController(
  existing: DiscoveryEntityRecord,
  incoming: DiscoveryEntityRecord,
): DiscoveryEntityRecord {
  return mergeRestEndpointEntity(
    "RestController",
    existing,
    incoming,
    REST_CONTROLLER_SCALAR_FIELDS,
    REST_CONTROLLER_MERGE_ARRAY_FIELDS,
  );
}

function mergeRestClient(
  existing: DiscoveryEntityRecord,
  incoming: DiscoveryEntityRecord,
): DiscoveryEntityRecord {
  const merged = mergeRestEndpointEntity(
    "RestClient",
    existing,
    incoming,
    REST_CLIENT_SCALAR_FIELDS,
    REST_CLIENT_MERGE_ARRAY_FIELDS,
  );
  // Deterministic origin resolution: a client discovered in module sources
  // wins over a supplemented copy regardless of processor execution order.
  if (existing.origin === "source" || incoming.origin === "source") {
    return { ...merged, origin: "source" };
  }
  return merged;
}

export function mergeDuplicateEntity(
  entityType: EntityType,
  existing: DiscoveryEntityRecord,
  incoming: DiscoveryEntityRecord,
): DiscoveryEntityRecord {
  if (entityType === "RestController") {
    return mergeRestController(existing, incoming);
  }
  if (entityType === "RestClient") {
    return mergeRestClient(existing, incoming);
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
