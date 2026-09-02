import { computeArchiId } from "../archimate-model/archi-id.js";

const INFERRED_REST_CONTRACT_ID_PREFIX = "inferredapicontract:";

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

export function buildInferredContractDocumentation(
  endpoints: readonly string[],
  dtoFqcn: readonly string[],
): string {
  const sections: string[] = [];

  if (endpoints.length > 0) {
    const sortedEndpoints = [...endpoints].sort((left, right) => left.localeCompare(right));
    sections.push(
      ["Endpoints:", ...sortedEndpoints.map((endpoint) => `- ${endpoint}`)].join("\n"),
    );
  }

  if (dtoFqcn.length > 0) {
    const sortedDtos = [...dtoFqcn].sort((left, right) => left.localeCompare(right));
    sections.push(["DTOs:", ...sortedDtos.map((dto) => `- ${dto}`)].join("\n"));
  }

  return sections.join("\n\n");
}
