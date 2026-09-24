import type { HttpApiDataTypeRecord } from "../../code-inventory/entities/http-api-data-type.js";
import type { RestClientRecord } from "../../code-inventory/entities/rest-client.js";
import type { RestControllerRecord } from "../../code-inventory/entities/rest-controller.js";

export const INFERRED_CLIENT_CONTROLLER_RANK_THRESHOLD = 0.15;

const ENDPOINT_WEIGHT = 0.5;
const DTO_WEIGHT = 0.5;

const ACTUATOR_PREFIX = "GET /actuator/";
const MANAGEMENT_PREFIX = "GET /management/";

export function isTrivialEndpoint(endpoint: string): boolean {
  const normalized = normalizeRestEndpoint(endpoint);
  if (normalized === "GET /") {
    return true;
  }
  if (normalized.startsWith(ACTUATOR_PREFIX)) {
    return true;
  }
  if (normalized.startsWith(MANAGEMENT_PREFIX)) {
    return true;
  }
  return false;
}

export function isEffectivelyEmptyEndpoints(endpoints: readonly string[]): boolean {
  if (endpoints.length === 0) {
    return true;
  }
  return endpoints.every((endpoint) => isTrivialEndpoint(endpoint));
}

export function normalizeRestEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) {
    return trimmed.toUpperCase();
  }
  const method = trimmed.slice(0, spaceIndex).toUpperCase();
  let path = trimmed.slice(spaceIndex + 1).trim();
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return `${method} ${path}`;
}

export function normalizeEndpointSet(endpoints: readonly string[]): Set<string> {
  const result = new Set<string>();
  for (const endpoint of endpoints) {
    if (isTrivialEndpoint(endpoint)) {
      continue;
    }
    result.add(normalizeRestEndpoint(endpoint));
  }
  return result;
}

export function resolveDtoFqcnSet(
  dataTypeIds: readonly string[],
  dataTypesById: ReadonlyMap<string, HttpApiDataTypeRecord>,
): Set<string> {
  const result = new Set<string>();
  for (const dataTypeId of dataTypeIds) {
    const record = dataTypesById.get(dataTypeId);
    if (record !== undefined) {
      result.add(record.fqcn);
    }
  }
  return result;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }
  const union = new Set([...left, ...right]).size;
  if (union === 0) {
    return 0;
  }
  return intersection / union;
}

export function computeClientControllerRank(
  client: RestClientRecord,
  controller: RestControllerRecord,
  dataTypesById: ReadonlyMap<string, HttpApiDataTypeRecord>,
): number {
  const clientEndpoints = normalizeEndpointSet(client.endpoints);
  const controllerEndpoints = normalizeEndpointSet(controller.endpoints);
  const clientDtos = resolveDtoFqcnSet(client.dataTypeIds, dataTypesById);
  const controllerDtos = resolveDtoFqcnSet(controller.dataTypeIds, dataTypesById);

  const endpointUnion =
    clientEndpoints.size > 0 || controllerEndpoints.size > 0
      ? new Set([...clientEndpoints, ...controllerEndpoints]).size
      : 0;
  const dtoUnion =
    clientDtos.size > 0 || controllerDtos.size > 0
      ? new Set([...clientDtos, ...controllerDtos]).size
      : 0;

  let weightedSum = 0;
  let norm = 0;

  if (endpointUnion > 0) {
    weightedSum += ENDPOINT_WEIGHT * jaccard(clientEndpoints, controllerEndpoints);
    norm += ENDPOINT_WEIGHT;
  }
  if (dtoUnion > 0) {
    weightedSum += DTO_WEIGHT * jaccard(clientDtos, controllerDtos);
    norm += DTO_WEIGHT;
  }

  if (norm === 0) {
    return 0;
  }
  return weightedSum / norm;
}

export function isEligibleRestEndpointEntity(input: {
  readonly contractIds: readonly string[];
  readonly endpoints: readonly string[];
  readonly dataTypeIds: readonly string[];
}): boolean {
  if (input.contractIds.length > 0) {
    return false;
  }
  if (isEffectivelyEmptyEndpoints(input.endpoints) && input.dataTypeIds.length === 0) {
    return false;
  }
  return true;
}
