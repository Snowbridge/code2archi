import {
  filterMeaningfulEndpoints,
  hasMeaningfulEndpoints,
} from "../../../../generate/rest-infrastructure-endpoints.js";
import type { HttpClientApiRecord } from "../../../../discovery-model/entities/http-client-api.js";
import type { HttpServerApiRecord } from "../../../../discovery-model/entities/http-server-api.js";
import { typeReferenceMatchKeys } from "../../../../discovery-model/entities/type-reference.js";
import {
  HttpClientToServerApiLink,
  type HttpClientToServerApiLinkMethod,
} from "../../../../discovery-model/links/http-client-to-server-api-link.js";

export interface HttpClientServerApiLinkCandidate {
  readonly httpServerApiId: string;
  readonly httpClientApiId: string;
  readonly sourceApplicationModuleId: string;
  readonly targetApplicationModuleId: string;
  readonly matchMethod: HttpClientToServerApiLinkMethod;
  readonly basis: "extract" | "inference";
  readonly confidence: number;
  readonly matchedValues: readonly string[];
}

function intersectSorted(left: readonly string[], right: readonly string[]): string[] {
  const matched: string[] = [];
  const leftSorted = [...left].sort((a, b) => a.localeCompare(b));
  const rightSet = new Set(right);

  for (const value of leftSorted) {
    if (rightSet.has(value)) {
      matched.push(value);
    }
  }

  return matched;
}

function jaccardIndex(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 && right.length === 0) {
    return 0;
  }

  const matched = intersectSorted(left, right);
  if (matched.length === 0) {
    return 0;
  }

  const union = new Set([...left, ...right]);
  return matched.length / union.size;
}

function matchContractType(
  server: HttpServerApiRecord,
  client: HttpClientApiRecord,
): HttpClientServerApiLinkCandidate | undefined {
  if (server.contractTypes.length === 0) {
    return undefined;
  }

  const matchedValues = intersectSorted(
    typeReferenceMatchKeys(server.contractTypes),
    typeReferenceMatchKeys(client.inheritedContractTypes),
  );
  if (matchedValues.length === 0) {
    return undefined;
  }

  return {
    httpServerApiId: server.id,
    httpClientApiId: client.id,
    sourceApplicationModuleId: server.applicationModuleId,
    targetApplicationModuleId: client.applicationModuleId,
    matchMethod: "CONTRACT_TYPE",
    basis: "extract",
    confidence: 1,
    matchedValues,
  };
}

function matchPayloadType(
  server: HttpServerApiRecord,
  client: HttpClientApiRecord,
): HttpClientServerApiLinkCandidate | undefined {
  if (server.payloadTypes.length === 0) {
    return undefined;
  }

  const serverKeys = typeReferenceMatchKeys(server.payloadTypes);
  const clientKeys = typeReferenceMatchKeys(client.payloadTypes);
  const matchedValues = intersectSorted(serverKeys, clientKeys);
  if (matchedValues.length === 0) {
    return undefined;
  }

  const jaccard = jaccardIndex(serverKeys, clientKeys);
  const confidence = Math.min(0.5, 0.25 + 0.25 * jaccard);

  return {
    httpServerApiId: server.id,
    httpClientApiId: client.id,
    sourceApplicationModuleId: server.applicationModuleId,
    targetApplicationModuleId: client.applicationModuleId,
    matchMethod: "PAYLOAD_TYPE",
    basis: "inference",
    confidence,
    matchedValues,
  };
}

function matchEndpoint(
  server: HttpServerApiRecord,
  client: HttpClientApiRecord,
): HttpClientServerApiLinkCandidate | undefined {
  if (!hasMeaningfulEndpoints(server.endpoints)) {
    return undefined;
  }

  const serverEndpoints = filterMeaningfulEndpoints(server.endpoints);
  const clientEndpoints = filterMeaningfulEndpoints(client.endpoints);
  const matchedValues = intersectSorted(serverEndpoints, clientEndpoints);
  if (matchedValues.length === 0) {
    return undefined;
  }

  const jaccard = jaccardIndex(serverEndpoints, clientEndpoints);
  const confidence = Math.min(0.85, 0.55 + 0.3 * jaccard);

  return {
    httpServerApiId: server.id,
    httpClientApiId: client.id,
    sourceApplicationModuleId: server.applicationModuleId,
    targetApplicationModuleId: client.applicationModuleId,
    matchMethod: "ENDPOINT",
    basis: "inference",
    confidence,
    matchedValues,
  };
}

export function matchHttpClientServerApiLinkCandidates(
  server: HttpServerApiRecord,
  client: HttpClientApiRecord,
): HttpClientServerApiLinkCandidate[] {
  if (server.applicationModuleId === client.applicationModuleId) {
    return [];
  }

  const candidates: HttpClientServerApiLinkCandidate[] = [];
  const contractMatch = matchContractType(server, client);
  if (contractMatch !== undefined) {
    candidates.push(contractMatch);
  }

  const endpointMatch = matchEndpoint(server, client);
  if (endpointMatch !== undefined) {
    candidates.push(endpointMatch);
  }

  const payloadMatch = matchPayloadType(server, client);
  if (payloadMatch !== undefined) {
    candidates.push(payloadMatch);
  }

  return candidates;
}

export function candidateToLink(
  candidate: HttpClientServerApiLinkCandidate,
): HttpClientToServerApiLink {
  return new HttpClientToServerApiLink({
    httpServerApiId: candidate.httpServerApiId,
    httpClientApiId: candidate.httpClientApiId,
    sourceApplicationModuleId: candidate.sourceApplicationModuleId,
    targetApplicationModuleId: candidate.targetApplicationModuleId,
    matchMethod: candidate.matchMethod,
    basis: candidate.basis,
    confidence: candidate.confidence,
    matchedValues: candidate.matchedValues,
  });
}

export function collectHttpClientToServerApiLinks(
  servers: readonly HttpServerApiRecord[],
  clients: readonly HttpClientApiRecord[],
): HttpClientToServerApiLink[] {
  const matches: HttpClientToServerApiLink[] = [];

  for (const server of servers) {
    for (const client of clients) {
      for (const candidate of matchHttpClientServerApiLinkCandidates(server, client)) {
        matches.push(candidateToLink(candidate));
      }
    }
  }

  return matches.sort((left, right) => left.id.localeCompare(right.id));
}
