import type { CodeInventorySnapshot } from "./code-inventory-snapshot.js";
import type { HttpApiContractBasis } from "./entities/http-api-contract.js";
import type { HttpApiContractAssignmentRecord } from "./links/http-api-contract-assignment.js";
import { getLogger } from "../platform/logging/index.js";

const logger = getLogger("generate.httpApiContractAssignment");

export interface ResolvedHttpApiContractAssignment {
  readonly contractId: string;
  readonly basis: HttpApiContractBasis;
  readonly confidence?: number;
  readonly linkId: string;
}

export function listAssignmentsForAssignee(
  snapshot: CodeInventorySnapshot,
  assigneeId: string,
): readonly HttpApiContractAssignmentRecord[] {
  return snapshot
    .listLinksByRef("HttpApiContractAssignment", "assigneeId", assigneeId)
    .map((link) => link as HttpApiContractAssignmentRecord)
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function pickAssignmentForContract(
  assignments: readonly HttpApiContractAssignmentRecord[],
  contractId: string,
): ResolvedHttpApiContractAssignment | undefined {
  const forContract = assignments.filter((item) => item.contractId === contractId);
  if (forContract.length === 0) {
    return undefined;
  }

  const extractLinks = forContract.filter((item) => item.basis === "extract");
  if (extractLinks.length > 0) {
    if (extractLinks.length > 1) {
      logger.warn("ambiguous extract HttpApiContractAssignment; picked first by link id", {
        contractId,
        assigneeId: extractLinks[0]?.assigneeId,
        candidateCount: extractLinks.length,
      });
    }
    const picked = [...extractLinks].sort((left, right) => left.id.localeCompare(right.id))[0]!;
    return {
      contractId: picked.contractId,
      basis: "extract",
      linkId: picked.id,
    };
  }

  const inferenceLinks = forContract.filter((item) => item.basis === "inference");
  if (inferenceLinks.length === 0) {
    return undefined;
  }

  const sorted = [...inferenceLinks].sort((left, right) => {
    const leftConfidence = left.confidence ?? 0;
    const rightConfidence = right.confidence ?? 0;
    if (rightConfidence !== leftConfidence) {
      return rightConfidence - leftConfidence;
    }
    return left.id.localeCompare(right.id);
  });
  const topConfidence = sorted[0]?.confidence ?? 0;
  const tied = sorted.filter((item) => (item.confidence ?? 0) === topConfidence);
  if (tied.length > 1) {
    logger.warn("ambiguous inference HttpApiContractAssignment; picked first by link id", {
      contractId,
      assigneeId: tied[0]?.assigneeId,
      confidence: topConfidence,
      candidateCount: tied.length,
    });
  }
  const picked = tied.sort((left, right) => left.id.localeCompare(right.id))[0]!;
  return {
    contractId: picked.contractId,
    basis: "inference",
    confidence: picked.confidence,
    linkId: picked.id,
  };
}

export function resolveAssignmentsForAssignee(
  snapshot: CodeInventorySnapshot,
  assigneeId: string,
): readonly ResolvedHttpApiContractAssignment[] {
  const all = listAssignmentsForAssignee(snapshot, assigneeId);
  const contractIds = [...new Set(all.map((item) => item.contractId))].sort((left, right) =>
    left.localeCompare(right),
  );
  const resolved: ResolvedHttpApiContractAssignment[] = [];
  for (const contractId of contractIds) {
    const picked = pickAssignmentForContract(all, contractId);
    if (picked !== undefined) {
      resolved.push(picked);
    }
  }
  return resolved;
}

export function resolvedContractIdsForAssignee(
  snapshot: CodeInventorySnapshot,
  assigneeId: string,
): readonly string[] {
  return resolveAssignmentsForAssignee(snapshot, assigneeId).map((item) => item.contractId);
}
