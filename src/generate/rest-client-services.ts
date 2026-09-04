import { computeArchiId } from "../archimate-model/archi-id.js";
import { filterMeaningfulEndpoints } from "./rest-infrastructure-endpoints.js";

export function restClientServiceLogicalId(restClientId: string): string {
  return `restclient:${restClientId}`;
}

export function restClientRealizationLogicalId(
  moduleId: string,
  restClientId: string,
): string {
  return `realization:app-module:${moduleId}:restclient:${restClientId}`;
}

export function restClientRealizationRelationshipId(
  appComponentId: string,
  restClientId: string,
): string {
  return computeArchiId("RealizationRelationship", appComponentId, restClientId);
}

export function buildRestClientEndpointsDocumentation(endpoints: readonly string[]): string | undefined {
  const meaningfulEndpoints = filterMeaningfulEndpoints(endpoints);
  if (meaningfulEndpoints.length === 0) {
    return undefined;
  }

  return ["Endpoints:", ...meaningfulEndpoints.map((endpoint) => `- ${endpoint}`)].join("\n");
}
