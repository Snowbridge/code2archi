import { computeArchiId } from "../archimate-model/archi-id.js";

const NODEJS_DECLARED_REST_CONTRACT_ID_PREFIX = "nodejsdeclaredapicontract:";

export function nodejsDeclaredRestContractId(qualifiedSymbol: string): string {
  return computeArchiId(
    "ApplicationInterface",
    `${NODEJS_DECLARED_REST_CONTRACT_ID_PREFIX}${qualifiedSymbol}`,
  );
}

export function nodejsDeclaredRestContractLogicalId(qualifiedSymbol: string): string {
  return `declaredrestcontract:${qualifiedSymbol}`;
}

export function nodejsDeclaredContractAssignmentId(
  contractId: string,
  nodejsRestControllerId: string,
): string {
  return computeArchiId("AssignmentRelationship", contractId, nodejsRestControllerId);
}

export function nodejsDeclaredContractAssignmentLogicalId(
  qualifiedSymbol: string,
  nodejsRestControllerId: string,
): string {
  return `assignment:declared-rest-contract:${qualifiedSymbol}:${nodejsRestControllerId}`;
}

export function nodejsDeclaredContractAssignmentToClientId(
  contractId: string,
  nodejsRestClientId: string,
): string {
  return computeArchiId("AssignmentRelationship", contractId, nodejsRestClientId);
}

export function nodejsDeclaredContractAssignmentToClientLogicalId(
  qualifiedSymbol: string,
  nodejsRestClientId: string,
): string {
  return `assignment:declared-rest-contract:${qualifiedSymbol}:${nodejsRestClientId}`;
}
