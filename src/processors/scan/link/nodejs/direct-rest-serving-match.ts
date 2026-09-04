import {
  filterMeaningfulEndpoints,
  hasMeaningfulEndpoints,
} from "../../../../generate/rest-infrastructure-endpoints.js";
import type { NodejsRestClientRecord } from "../../../../discovery-model/entities/nodejs-rest-client.js";
import type { NodejsRestControllerRecord } from "../../../../discovery-model/entities/nodejs-rest-controller.js";
import {
  NodejsDirectRestRequestsServingMatch,
  type NodejsDirectRestRequestsServingMatchMethod,
} from "../../../../discovery-model/links/nodejs-direct-rest-requests-serving-match.js";

export interface NodejsDirectRestServingMatchCandidate {
  readonly nodejsRestControllerId: string;
  readonly nodejsRestClientId: string;
  readonly sourceApplicationModuleId: string;
  readonly targetApplicationModuleId: string;
  readonly matchMethod: NodejsDirectRestRequestsServingMatchMethod;
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
  controller: NodejsRestControllerRecord,
  client: NodejsRestClientRecord,
): NodejsDirectRestServingMatchCandidate | undefined {
  if (controller.implementsTypeNames.length === 0) {
    return undefined;
  }

  const matchedValues = intersectSorted(controller.implementsTypeNames, client.extendsTypeNames);
  if (matchedValues.length === 0) {
    return undefined;
  }

  return {
    nodejsRestControllerId: controller.id,
    nodejsRestClientId: client.id,
    sourceApplicationModuleId: controller.applicationModuleId,
    targetApplicationModuleId: client.applicationModuleId,
    matchMethod: "INTERFACE",
    confidence: "confirmed",
    confidenceScore: 1,
    matchedValues,
  };
}

function matchDto(
  controller: NodejsRestControllerRecord,
  client: NodejsRestClientRecord,
): NodejsDirectRestServingMatchCandidate | undefined {
  if (controller.dtoTypes.length === 0) {
    return undefined;
  }

  const matchedValues = intersectSorted(controller.dtoTypes, client.dtoTypes);
  if (matchedValues.length === 0) {
    return undefined;
  }

  const jaccard = jaccardIndex(controller.dtoTypes, client.dtoTypes);
  const confidenceScore = Math.min(0.85, 0.55 + 0.3 * jaccard);

  return {
    nodejsRestControllerId: controller.id,
    nodejsRestClientId: client.id,
    sourceApplicationModuleId: controller.applicationModuleId,
    targetApplicationModuleId: client.applicationModuleId,
    matchMethod: "DTO",
    confidence: "inferred",
    confidenceScore,
    matchedValues,
  };
}

function matchEndpoint(
  controller: NodejsRestControllerRecord,
  client: NodejsRestClientRecord,
): NodejsDirectRestServingMatchCandidate | undefined {
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
    nodejsRestControllerId: controller.id,
    nodejsRestClientId: client.id,
    sourceApplicationModuleId: controller.applicationModuleId,
    targetApplicationModuleId: client.applicationModuleId,
    matchMethod: "ENDPOINT",
    confidence: "inferred",
    confidenceScore,
    matchedValues,
  };
}

export function matchNodejsDirectRestServingCandidates(
  controller: NodejsRestControllerRecord,
  client: NodejsRestClientRecord,
): NodejsDirectRestServingMatchCandidate[] {
  if (controller.applicationModuleId === client.applicationModuleId) {
    return [];
  }

  const candidates: NodejsDirectRestServingMatchCandidate[] = [];
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

export function nodejsCandidateToLink(
  candidate: NodejsDirectRestServingMatchCandidate,
): NodejsDirectRestRequestsServingMatch {
  return new NodejsDirectRestRequestsServingMatch({
    nodejsRestControllerId: candidate.nodejsRestControllerId,
    nodejsRestClientId: candidate.nodejsRestClientId,
    sourceApplicationModuleId: candidate.sourceApplicationModuleId,
    targetApplicationModuleId: candidate.targetApplicationModuleId,
    matchMethod: candidate.matchMethod,
    confidence: candidate.confidence,
    confidenceScore: candidate.confidenceScore,
    matchedValues: candidate.matchedValues,
  });
}

export function collectNodejsDirectRestServingMatches(
  controllers: readonly NodejsRestControllerRecord[],
  clients: readonly NodejsRestClientRecord[],
): NodejsDirectRestRequestsServingMatch[] {
  const matches: NodejsDirectRestRequestsServingMatch[] = [];

  for (const controller of controllers) {
    for (const client of clients) {
      for (const candidate of matchNodejsDirectRestServingCandidates(controller, client)) {
        matches.push(nodejsCandidateToLink(candidate));
      }
    }
  }

  return matches.sort((left, right) => left.id.localeCompare(right.id));
}
