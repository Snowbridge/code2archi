import { HttpApiContractAssignment } from "../../src/code-inventory/links/http-api-contract-assignment.js";

export function extractAssignmentIntent(
  contractId: string,
  assigneeId: string,
): ReturnType<HttpApiContractAssignment["toCreateIntent"]> {
  return HttpApiContractAssignment.forExtract(contractId, assigneeId).toCreateIntent();
}

export function inferenceAssignmentIntent(
  contractId: string,
  assigneeId: string,
  confidence: number,
): ReturnType<HttpApiContractAssignment["toCreateIntent"]> {
  return HttpApiContractAssignment.forInference(contractId, assigneeId, confidence).toCreateIntent();
}
