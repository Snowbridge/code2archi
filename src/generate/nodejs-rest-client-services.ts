import { computeArchiId } from "../archimate-model/archi-id.js";
import { filterMeaningfulEndpoints } from "./rest-infrastructure-endpoints.js";

export function nodejsRestClientServiceLogicalId(nodejsRestClientId: string): string {
  return `nodejsrestclient:${nodejsRestClientId}`;
}

export function nodejsRestClientRealizationLogicalId(
  moduleId: string,
  nodejsRestClientId: string,
): string {
  return `realization:app-module:${moduleId}:nodejsrestclient:${nodejsRestClientId}`;
}

export function nodejsRestClientRealizationRelationshipId(
  appComponentId: string,
  nodejsRestClientId: string,
): string {
  return computeArchiId("RealizationRelationship", appComponentId, nodejsRestClientId);
}

export function buildNodejsRestClientEndpointsDocumentation(
  endpoints: readonly string[],
): string | undefined {
  const meaningfulEndpoints = filterMeaningfulEndpoints(endpoints);
  if (meaningfulEndpoints.length === 0) {
    return undefined;
  }

  return ["Endpoints:", ...meaningfulEndpoints.map((endpoint) => `- ${endpoint}`)].join("\n");
}

export function nodejsExtendedTypeNamesList(
  extendsTypeNames: readonly string[],
): readonly string[] {
  return [...extendsTypeNames].sort((left, right) => left.localeCompare(right));
}
