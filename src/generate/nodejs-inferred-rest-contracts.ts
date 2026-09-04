import { computeArchiId } from "../archimate-model/archi-id.js";
import {
  filterMeaningfulEndpoints,
  hasMeaningfulEndpoints,
} from "./rest-infrastructure-endpoints.js";

const NODEJS_INFERRED_REST_CONTRACT_ID_PREFIX = "nodejsinferredapicontract:";

export function isEligibleForNodejsInferredRestContract(
  endpoints: readonly string[],
  dtoTypes: readonly string[],
): boolean {
  return dtoTypes.length > 0 || hasMeaningfulEndpoints(endpoints);
}

export function nodejsInferredRestContractId(qualifiedSymbol: string): string {
  return computeArchiId(
    "ApplicationInterface",
    `${NODEJS_INFERRED_REST_CONTRACT_ID_PREFIX}${qualifiedSymbol}`,
  );
}

export function nodejsInferredRestContractLogicalId(qualifiedSymbol: string): string {
  return `inferredrestcontract:${qualifiedSymbol}`;
}

export function nodejsInferredContractAssignmentId(
  contractId: string,
  nodejsRestControllerId: string,
): string {
  return computeArchiId("AssignmentRelationship", contractId, nodejsRestControllerId);
}

export function nodejsInferredContractAssignmentLogicalId(
  qualifiedSymbol: string,
  nodejsRestControllerId: string,
): string {
  return `assignment:inferred-rest-contract:${qualifiedSymbol}:${nodejsRestControllerId}`;
}

export function nodejsInferredContractAssignmentToClientId(
  contractId: string,
  nodejsRestClientId: string,
): string {
  return computeArchiId("AssignmentRelationship", contractId, nodejsRestClientId);
}

export function nodejsInferredContractAssignmentToClientLogicalId(
  qualifiedSymbol: string,
  nodejsRestClientId: string,
): string {
  return `assignment:inferred-rest-contract:${qualifiedSymbol}:${nodejsRestClientId}`;
}

export function buildNodejsInferredContractDocumentation(
  endpoints: readonly string[],
  dtoTypes: readonly string[],
): string {
  const sections: string[] = [];

  const meaningfulEndpoints = filterMeaningfulEndpoints(endpoints);
  if (meaningfulEndpoints.length > 0) {
    sections.push(
      ["Endpoints:", ...meaningfulEndpoints.map((endpoint) => `- ${endpoint}`)].join("\n"),
    );
  }

  if (dtoTypes.length > 0) {
    const sortedDtos = [...dtoTypes].sort((left, right) => left.localeCompare(right));
    sections.push(["DTOs:", ...sortedDtos.map((dto) => `- ${dto}`)].join("\n"));
  }

  return sections.join("\n\n");
}

export function simpleNameFromQualifiedSymbol(qualifiedSymbol: string): string {
  const hashIndex = qualifiedSymbol.lastIndexOf("#");
  if (hashIndex >= 0) {
    return qualifiedSymbol.slice(hashIndex + 1);
  }

  const slashIndex = qualifiedSymbol.lastIndexOf("/");
  if (slashIndex >= 0) {
    return qualifiedSymbol.slice(slashIndex + 1);
  }

  return qualifiedSymbol;
}
