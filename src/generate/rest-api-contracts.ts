import { computeArchiId } from "../archimate-model/archi-id.js";
import { filterMeaningfulEndpoints } from "./rest-infrastructure-endpoints.js";
import type { HttpClientToServerApiLinkMethod } from "../code-inventory/links/http-client-to-server-api-link.js";
import type { TypeReference } from "../code-inventory/entities/type-reference.js";
import { typeReferenceMatchKeys } from "../code-inventory/entities/type-reference.js";
import {
  compareDirectRestServingMatches,
  type DirectRestServingMatchLike,
} from "./direct-rest-serving.js";

export function restApiContractElementId(applicationModuleId: string, symbolKey: string): string {
  return computeArchiId("ApplicationInterface", "api-contract", applicationModuleId, symbolKey);
}

export function restApiContractLogicalId(applicationModuleId: string, symbolKey: string): string {
  return `api-contract:${applicationModuleId}:${symbolKey}`;
}

export function restApiContractAssignmentLogicalId(
  applicationModuleId: string,
  symbolKey: string,
  role: "restcontroller" | "restclient",
  peerId: string,
): string {
  return `assignment:rest-api-contract:${applicationModuleId}:${symbolKey}:${role}:${peerId}`;
}

export function restApiContractAssignmentRelationshipId(
  contractElementId: string,
  peerElementId: string,
): string {
  return computeArchiId("AssignmentRelationship", contractElementId, peerElementId);
}

export function buildRestApiContractDocumentation(input: {
  readonly endpoints: readonly string[];
  readonly payloadTypes: readonly TypeReference[];
  readonly contractTypes: readonly TypeReference[];
}): string | undefined {
  const sections: string[] = [];

  const meaningfulEndpoints = filterMeaningfulEndpoints(input.endpoints);
  if (meaningfulEndpoints.length > 0) {
    sections.push("Endpoints:", ...meaningfulEndpoints.map((endpoint) => `- ${endpoint}`));
  }

  const payloadKeys = typeReferenceMatchKeys(input.payloadTypes);
  if (payloadKeys.length > 0) {
    if (sections.length > 0) {
      sections.push("");
    }
    sections.push("Payload types:", ...[...payloadKeys].sort((a, b) => a.localeCompare(b)).map((dto) => `- ${dto}`));
  }

  const contractKeys = typeReferenceMatchKeys(input.contractTypes);
  if (contractKeys.length > 0) {
    if (sections.length > 0) {
      sections.push("");
    }
    sections.push(
      "Contract types:",
      ...[...contractKeys].sort((a, b) => a.localeCompare(b)).map((name) => `- ${name}`),
    );
  }

  if (sections.length === 0) {
    return undefined;
  }

  return sections.join("\n");
}

export interface HttpClientToServerApiLinkLike extends DirectRestServingMatchLike {
  readonly httpServerApiId: string;
  readonly httpClientApiId: string;
}

export function selectBestHttpClientToServerApiLinksPerClient(
  links: readonly HttpClientToServerApiLinkLike[],
): HttpClientToServerApiLinkLike[] {
  const bestByClientAndServer = new Map<string, HttpClientToServerApiLinkLike>();

  for (const link of links) {
    const key = `${link.httpClientApiId}\u0000${link.httpServerApiId}`;
    const currentBest = bestByClientAndServer.get(key);
    if (currentBest === undefined || compareDirectRestServingMatches(link, currentBest) < 0) {
      bestByClientAndServer.set(key, link);
    }
  }

  return [...bestByClientAndServer.values()].sort((left, right) => {
    const clientCompare = left.httpClientApiId.localeCompare(right.httpClientApiId);
    if (clientCompare !== 0) {
      return clientCompare;
    }

    const serverCompare = left.httpServerApiId.localeCompare(right.httpServerApiId);
    if (serverCompare !== 0) {
      return serverCompare;
    }

    return compareDirectRestServingMatches(left, right);
  });
}

export type { HttpClientToServerApiLinkMethod };

/** @deprecated Use selectBestHttpClientToServerApiLinksPerClient */
export const selectBestRestClientToControllerLinksPerClient =
  selectBestHttpClientToServerApiLinksPerClient;
