import { computeArchiId } from "../archimate-model/archi-id.js";
import {
  filterMeaningfulEndpoints,
  hasMeaningfulEndpoints,
} from "./rest-infrastructure-endpoints.js";

const INFERRED_REST_CONTRACT_ID_PREFIX = "inferredapicontract:";

export function isEligibleForInferredRestContract(
  endpoints: readonly string[],
  dtoFqcn: readonly string[],
): boolean {
  return dtoFqcn.length > 0 || hasMeaningfulEndpoints(endpoints);
}

export function inferredRestContractId(fqcn: string): string {
  return computeArchiId("ApplicationInterface", `${INFERRED_REST_CONTRACT_ID_PREFIX}${fqcn}`);
}

export function inferredRestContractLogicalId(fqcn: string): string {
  return `inferredrestcontract:${fqcn}`;
}

export function inferredContractAssignmentId(
  contractId: string,
  restControllerId: string,
): string {
  return computeArchiId("AssignmentRelationship", contractId, restControllerId);
}

export function inferredContractAssignmentLogicalId(
  fqcn: string,
  restControllerId: string,
): string {
  return `assignment:inferred-rest-contract:${fqcn}:${restControllerId}`;
}

export function inferredContractAssignmentToClientId(
  contractId: string,
  restClientId: string,
): string {
  return computeArchiId("AssignmentRelationship", contractId, restClientId);
}

export function inferredContractAssignmentToClientLogicalId(
  fqcn: string,
  restClientId: string,
): string {
  return `assignment:inferred-rest-contract:${fqcn}:${restClientId}`;
}

export function buildInferredContractDocumentation(
  endpoints: readonly string[],
  dtoFqcn: readonly string[],
): string {
  const sections: string[] = [];

  const meaningfulEndpoints = filterMeaningfulEndpoints(endpoints);
  if (meaningfulEndpoints.length > 0) {
    sections.push(
      ["Endpoints:", ...meaningfulEndpoints.map((endpoint) => `- ${endpoint}`)].join("\n"),
    );
  }

  if (dtoFqcn.length > 0) {
    const sortedDtos = [...dtoFqcn].sort((left, right) => left.localeCompare(right));
    sections.push(["DTOs:", ...sortedDtos.map((dto) => `- ${dto}`)].join("\n"));
  }

  return sections.join("\n\n");
}
