import { computeArchiId } from "../archimate-model/archi-id.js";
import { filterMeaningfulEndpoints } from "./rest-infrastructure-endpoints.js";

export function restControllerServiceLogicalId(restControllerId: string): string {
  return `restcontroller:${restControllerId}`;
}

export function restControllerRealizationLogicalId(
  moduleId: string,
  restControllerId: string,
): string {
  return `realization:app-module:${moduleId}:restcontroller:${restControllerId}`;
}

export function restControllerRealizationRelationshipId(
  appComponentId: string,
  restControllerId: string,
): string {
  return computeArchiId("RealizationRelationship", appComponentId, restControllerId);
}

export function buildRestControllerEndpointsDocumentation(
  endpoints: readonly string[],
): string | undefined {
  const meaningfulEndpoints = filterMeaningfulEndpoints(endpoints);
  if (meaningfulEndpoints.length === 0) {
    return undefined;
  }

  return ["Endpoints:", ...meaningfulEndpoints.map((endpoint) => `- ${endpoint}`)].join("\n");
}
