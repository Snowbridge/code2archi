import { computeArchiId } from "../archimate-model/archi-id.js";
import { filterMeaningfulEndpoints } from "./rest-infrastructure-endpoints.js";
import type { RestClientToControllerLinkMethod } from "../discovery-model/links/rest-client-to-controller-link.js";
import {
  compareDirectRestServingMatches,
  type DirectRestServingMatchLike,
} from "./direct-rest-serving.js";

export function restApiContractElementId(applicationModuleId: string, fqcn: string): string {
  return computeArchiId("ApplicationInterface", "api-contract", applicationModuleId, fqcn);
}

export function restApiContractLogicalId(applicationModuleId: string, fqcn: string): string {
  return `api-contract:${applicationModuleId}:${fqcn}`;
}

export function restApiContractAssignmentLogicalId(
  applicationModuleId: string,
  fqcn: string,
  role: "restcontroller" | "restclient",
  peerId: string,
): string {
  return `assignment:rest-api-contract:${applicationModuleId}:${fqcn}:${role}:${peerId}`;
}

export function restApiContractAssignmentRelationshipId(
  contractElementId: string,
  peerElementId: string,
): string {
  return computeArchiId("AssignmentRelationship", contractElementId, peerElementId);
}

export function buildRestApiContractDocumentation(input: {
  readonly endpoints: readonly string[];
  readonly dtoFqcn: readonly string[];
  readonly implementedInterfaceFqcn: readonly string[];
}): string | undefined {
  const sections: string[] = [];

  const meaningfulEndpoints = filterMeaningfulEndpoints(input.endpoints);
  if (meaningfulEndpoints.length > 0) {
    sections.push("Endpoints:", ...meaningfulEndpoints.map((endpoint) => `- ${endpoint}`));
  }

  if (input.dtoFqcn.length > 0) {
    if (sections.length > 0) {
      sections.push("");
    }
    sections.push("DTOs:", ...[...input.dtoFqcn].sort((a, b) => a.localeCompare(b)).map((dto) => `- ${dto}`));
  }

  if (input.implementedInterfaceFqcn.length > 0) {
    if (sections.length > 0) {
      sections.push("");
    }
    sections.push(
      "Implemented interfaces:",
      ...[...input.implementedInterfaceFqcn]
        .sort((a, b) => a.localeCompare(b))
        .map((fqcn) => `- ${fqcn}`),
    );
  }

  if (sections.length === 0) {
    return undefined;
  }

  return sections.join("\n");
}

export interface RestClientToControllerLinkLike extends DirectRestServingMatchLike {
  readonly restControllerId: string;
  readonly restClientId: string;
}

export function selectBestRestClientToControllerLinksPerClient(
  links: readonly RestClientToControllerLinkLike[],
): RestClientToControllerLinkLike[] {
  const bestByClientAndController = new Map<string, RestClientToControllerLinkLike>();

  for (const link of links) {
    const key = `${link.restClientId}\u0000${link.restControllerId}`;
    const currentBest = bestByClientAndController.get(key);
    if (currentBest === undefined || compareDirectRestServingMatches(link, currentBest) < 0) {
      bestByClientAndController.set(key, link);
    }
  }

  return [...bestByClientAndController.values()].sort((left, right) => {
    const clientCompare = left.restClientId.localeCompare(right.restClientId);
    if (clientCompare !== 0) {
      return clientCompare;
    }

    const controllerCompare = left.restControllerId.localeCompare(right.restControllerId);
    if (controllerCompare !== 0) {
      return controllerCompare;
    }

    return compareDirectRestServingMatches(left, right);
  });
}

export type { RestClientToControllerLinkMethod };
