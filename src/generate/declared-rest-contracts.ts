import { computeArchiId } from "../archimate-model/archi-id.js";

const DECLARED_REST_CONTRACT_ID_PREFIX = "apicontract:";

export function simpleNameFromFqcn(fqcn: string): string {
  return fqcn.includes(".") ? (fqcn.split(".").at(-1) ?? fqcn) : fqcn;
}

export function declaredRestContractId(fqcn: string): string {
  return computeArchiId("ApplicationInterface", `${DECLARED_REST_CONTRACT_ID_PREFIX}${fqcn}`);
}

export function declaredRestContractLogicalId(fqcn: string): string {
  return `declaredrestcontract:${fqcn}`;
}

export function declaredContractAssignmentId(
  contractId: string,
  restControllerId: string,
): string {
  return computeArchiId("AssignmentRelationship", contractId, restControllerId);
}

export function declaredContractAssignmentLogicalId(
  fqcn: string,
  restControllerId: string,
): string {
  return `assignment:declared-rest-contract:${fqcn}:${restControllerId}`;
}

export function declaredContractAssignmentToClientId(
  contractId: string,
  restClientId: string,
): string {
  return computeArchiId("AssignmentRelationship", contractId, restClientId);
}

export function declaredContractAssignmentToClientLogicalId(
  fqcn: string,
  restClientId: string,
): string {
  return `assignment:declared-rest-contract:${fqcn}:${restClientId}`;
}
