import { computeArchiId } from "../archimate-model/archi-id.js";
import type { RestClientRecord } from "../discovery-model/entities/rest-client.js";

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

export function extendedInterfaceFqcnList(client: RestClientRecord): readonly string[] {
  return [...new Set(client.extendedInterfaceFqcn)].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function buildRestClientEndpointsDocumentation(endpoints: readonly string[]): string | undefined {
  if (endpoints.length === 0) {
    return undefined;
  }

  const sortedEndpoints = [...endpoints].sort((left, right) => left.localeCompare(right));
  return ["Endpoints:", ...sortedEndpoints.map((endpoint) => `- ${endpoint}`)].join("\n");
}
