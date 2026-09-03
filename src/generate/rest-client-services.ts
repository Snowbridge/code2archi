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

export function declaredContractFqcnList(client: RestClientRecord): readonly string[] {
  const merged = new Set<string>([client.fqcn, ...client.extendedInterfaceFqcn]);
  return [...merged].sort((left, right) => left.localeCompare(right));
}

export function buildRestClientEndpointsDocumentation(endpoints: readonly string[]): string | undefined {
  if (endpoints.length === 0) {
    return undefined;
  }

  const sortedEndpoints = [...endpoints].sort((left, right) => left.localeCompare(right));
  return ["Endpoints:", ...sortedEndpoints.map((endpoint) => `- ${endpoint}`)].join("\n");
}
