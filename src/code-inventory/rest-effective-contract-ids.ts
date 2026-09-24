import type { CodeInventorySnapshot } from "./code-inventory-snapshot.js";
import type { InferredHttpApiContractAssignmentRecord } from "./links/inferred-http-api-contract-assignment.js";

export function effectiveContractIdsForAssignee(
  declaredContractIds: readonly string[],
  assigneeId: string,
  snapshot: CodeInventorySnapshot,
): readonly string[] {
  const inferred = snapshot
    .listLinksByRef("InferredHttpApiContractAssignment", "assigneeId", assigneeId)
    .map((link) => (link as InferredHttpApiContractAssignmentRecord).contractId);

  return [...new Set([...declaredContractIds, ...inferred])].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function inferredAssignmentConfidenceByContract(
  assigneeId: string,
  snapshot: CodeInventorySnapshot,
): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const link of snapshot.listLinksByRef(
    "InferredHttpApiContractAssignment",
    "assigneeId",
    assigneeId,
  )) {
    const record = link as InferredHttpApiContractAssignmentRecord;
    map.set(record.contractId, record.confidence);
  }
  return map;
}
