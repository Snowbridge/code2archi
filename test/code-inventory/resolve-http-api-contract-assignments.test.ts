import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCodeInventorySnapshot } from "../../src/code-inventory/code-inventory-snapshot.js";
import {
  pickAssignmentForContract,
  resolveAssignmentsForAssignee,
} from "../../src/code-inventory/resolve-http-api-contract-assignments.js";
import type { HttpApiContractAssignmentRecord } from "../../src/code-inventory/links/http-api-contract-assignment.js";

function assignment(
  partial: Pick<HttpApiContractAssignmentRecord, "id" | "contractId" | "assigneeId" | "basis"> &
    Partial<Pick<HttpApiContractAssignmentRecord, "confidence">>,
): HttpApiContractAssignmentRecord {
  return {
    ...partial,
    confidence: partial.confidence,
  };
}

describe("resolve-http-api-contract-assignments", () => {
  it("prefers extract over inference for the same pair", () => {
    const links = [
      assignment({
        id: "inf-1",
        contractId: "c-1",
        assigneeId: "a-1",
        basis: "inference",
        confidence: 1,
      }),
      assignment({
        id: "ext-1",
        contractId: "c-1",
        assigneeId: "a-1",
        basis: "extract",
      }),
    ];
    const picked = pickAssignmentForContract(links, "c-1");
    assert.equal(picked?.basis, "extract");
    assert.equal(picked?.linkId, "ext-1");
  });

  it("picks highest confidence among inference links", () => {
    const links = [
      assignment({
        id: "inf-low",
        contractId: "c-1",
        assigneeId: "a-1",
        basis: "inference",
        confidence: 0.5,
      }),
      assignment({
        id: "inf-high",
        contractId: "c-1",
        assigneeId: "a-1",
        basis: "inference",
        confidence: 0.9,
      }),
    ];
    const picked = pickAssignmentForContract(links, "c-1");
    assert.equal(picked?.linkId, "inf-high");
    assert.equal(picked?.confidence, 0.9);
  });

  it("resolves one assignment per contract id for assignee", () => {
    const snapshot = buildCodeInventorySnapshot({
      scanId: "scan-1",
      sourceRoot: "/repo",
      runStartedAt: new Date("2026-01-01T00:00:00Z"),
      entityArrays: {},
      linkArrays: {
        HttpApiContractAssignment: [
          assignment({
            id: "l-1",
            contractId: "c-2",
            assigneeId: "a-1",
            basis: "extract",
          }),
          assignment({
            id: "l-2",
            contractId: "c-1",
            assigneeId: "a-1",
            basis: "extract",
          }),
        ],
      },
    });
    const resolved = resolveAssignmentsForAssignee(snapshot, "a-1");
    assert.deepEqual(resolved.map((item) => item.contractId), ["c-1", "c-2"]);
  });
});
