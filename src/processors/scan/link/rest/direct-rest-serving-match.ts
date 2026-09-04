import {
  filterMeaningfulEndpoints,
  hasMeaningfulEndpoints,
} from "../../../../generate/rest-infrastructure-endpoints.js";
import type { RestClientRecord } from "../../../../discovery-model/entities/rest-client.js";
import type { RestControllerRecord } from "../../../../discovery-model/entities/rest-controller.js";
import {
  DirectRestRequestsServingMatch,
  type DirectRestRequestsServingMatchMethod,
} from "../../../../discovery-model/links/direct-rest-requests-serving-match.js";

export interface DirectRestServingMatchCandidate {
  readonly restControllerId: string;
  readonly restClientId: string;
  readonly sourceApplicationModuleId: string;
  readonly targetApplicationModuleId: string;
  readonly matchMethod: DirectRestRequestsServingMatchMethod;
  readonly confidence: "confirmed" | "inferred";
  readonly confidenceScore: number;
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

function matchInterface(
  controller: RestControllerRecord,
  client: RestClientRecord,
): DirectRestServingMatchCandidate | undefined {
  if (controller.implementedInterfaceFqcn.length === 0) {
    return undefined;
  }

  const matchedValues = intersectSorted(
    controller.implementedInterfaceFqcn,
    client.extendedInterfaceFqcn,
  );
  if (matchedValues.length === 0) {
    return undefined;
  }

  return {
    restControllerId: controller.id,
    restClientId: client.id,
    sourceApplicationModuleId: controller.applicationModuleId,
    targetApplicationModuleId: client.applicationModuleId,
    matchMethod: "INTERFACE",
    confidence: "confirmed",
    confidenceScore: 1,
    matchedValues,
  };
}

function matchDto(
  controller: RestControllerRecord,
  client: RestClientRecord,
): DirectRestServingMatchCandidate | undefined {
  if (controller.dtoFqcn.length === 0) {
    return undefined;
  }

  const matchedValues = intersectSorted(controller.dtoFqcn, client.dtoFqcn);
  if (matchedValues.length === 0) {
    return undefined;
  }

  const jaccard = jaccardIndex(controller.dtoFqcn, client.dtoFqcn);
  const confidenceScore = Math.min(0.85, 0.55 + 0.3 * jaccard);

  return {
    restControllerId: controller.id,
    restClientId: client.id,
    sourceApplicationModuleId: controller.applicationModuleId,
    targetApplicationModuleId: client.applicationModuleId,
    matchMethod: "DTO",
    confidence: "inferred",
    confidenceScore,
    matchedValues,
  };
}

function matchEndpoint(
  controller: RestControllerRecord,
  client: RestClientRecord,
): DirectRestServingMatchCandidate | undefined {
  if (!hasMeaningfulEndpoints(controller.endpoints)) {
    return undefined;
  }

  const controllerEndpoints = filterMeaningfulEndpoints(controller.endpoints);
  const clientEndpoints = filterMeaningfulEndpoints(client.endpoints);
  const matchedValues = intersectSorted(controllerEndpoints, clientEndpoints);
  if (matchedValues.length === 0) {
    return undefined;
  }

  const jaccard = jaccardIndex(controllerEndpoints, clientEndpoints);
  const confidenceScore = Math.min(0.5, 0.25 + 0.25 * jaccard);

  return {
    restControllerId: controller.id,
    restClientId: client.id,
    sourceApplicationModuleId: controller.applicationModuleId,
    targetApplicationModuleId: client.applicationModuleId,
    matchMethod: "ENDPOINT",
    confidence: "inferred",
    confidenceScore,
    matchedValues,
  };
}

export function matchDirectRestServingCandidates(
  controller: RestControllerRecord,
  client: RestClientRecord,
): DirectRestServingMatchCandidate[] {
  if (controller.applicationModuleId === client.applicationModuleId) {
    return [];
  }

  const candidates: DirectRestServingMatchCandidate[] = [];
  const interfaceMatch = matchInterface(controller, client);
  if (interfaceMatch !== undefined) {
    candidates.push(interfaceMatch);
  }

  const dtoMatch = matchDto(controller, client);
  if (dtoMatch !== undefined) {
    candidates.push(dtoMatch);
  }

  const endpointMatch = matchEndpoint(controller, client);
  if (endpointMatch !== undefined) {
    candidates.push(endpointMatch);
  }

  return candidates;
}

export function candidateToLink(candidate: DirectRestServingMatchCandidate): DirectRestRequestsServingMatch {
  return new DirectRestRequestsServingMatch({
    restControllerId: candidate.restControllerId,
    restClientId: candidate.restClientId,
    sourceApplicationModuleId: candidate.sourceApplicationModuleId,
    targetApplicationModuleId: candidate.targetApplicationModuleId,
    matchMethod: candidate.matchMethod,
    confidence: candidate.confidence,
    confidenceScore: candidate.confidenceScore,
    matchedValues: candidate.matchedValues,
  });
}

export function collectDirectRestServingMatches(
  controllers: readonly RestControllerRecord[],
  clients: readonly RestClientRecord[],
): DirectRestRequestsServingMatch[] {
  const matches: DirectRestRequestsServingMatch[] = [];

  for (const controller of controllers) {
    for (const client of clients) {
      for (const candidate of matchDirectRestServingCandidates(controller, client)) {
        matches.push(candidateToLink(candidate));
      }
    }
  }

  return matches.sort((left, right) => left.id.localeCompare(right.id));
}
