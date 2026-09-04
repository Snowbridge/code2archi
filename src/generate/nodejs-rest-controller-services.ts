import { computeArchiId } from "../archimate-model/archi-id.js";
import { filterMeaningfulEndpoints } from "./rest-infrastructure-endpoints.js";

export function nodejsRestControllerServiceLogicalId(nodejsRestControllerId: string): string {
  return `nodejsrestcontroller:${nodejsRestControllerId}`;
}

export function nodejsRestControllerRealizationLogicalId(
  moduleId: string,
  nodejsRestControllerId: string,
): string {
  return `realization:app-module:${moduleId}:nodejsrestcontroller:${nodejsRestControllerId}`;
}

export function nodejsRestControllerRealizationRelationshipId(
  appComponentId: string,
  nodejsRestControllerId: string,
): string {
  return computeArchiId("RealizationRelationship", appComponentId, nodejsRestControllerId);
}

export function buildNodejsRestControllerEndpointsDocumentation(
  endpoints: readonly string[],
): string | undefined {
  const meaningfulEndpoints = filterMeaningfulEndpoints(endpoints);
  if (meaningfulEndpoints.length === 0) {
    return undefined;
  }

  return ["Endpoints:", ...meaningfulEndpoints.map((endpoint) => `- ${endpoint}`)].join("\n");
}
