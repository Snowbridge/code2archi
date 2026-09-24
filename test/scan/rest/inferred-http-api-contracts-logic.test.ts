import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCodeInventorySnapshot } from "../../../src/code-inventory/code-inventory-snapshot.js";
import {
  computeClientControllerRank,
  isEffectivelyEmptyEndpoints,
  isEligibleForInferenceAssignee,
  normalizeRestEndpoint,
} from "../../../src/scan/rest/inferred-http-api-contracts-logic.js";
import type { RestClientRecord } from "../../../src/code-inventory/entities/rest-client.js";
import type { RestControllerRecord } from "../../../src/code-inventory/entities/rest-controller.js";

describe("inferred-http-api-contracts-logic", () => {
  it("treats actuator-only endpoints as empty", () => {
    assert.equal(isEffectivelyEmptyEndpoints(["GET /actuator/health"]), true);
    assert.equal(isEffectivelyEmptyEndpoints(["GET /api/items"]), false);
  });

  it("normalizes trailing slash on paths", () => {
    assert.equal(normalizeRestEndpoint("get /foo/"), "GET /foo");
    assert.equal(normalizeRestEndpoint("GET /"), "GET /");
  });

  it("computes rank from endpoint overlap", () => {
    const controller = {
      endpoints: ["GET /items"],
      dataTypeIds: [],
    } as RestControllerRecord;
    const client = {
      endpoints: ["GET /items/"],
      dataTypeIds: [],
    } as RestClientRecord;
    const rank = computeClientControllerRank(client, controller, new Map());
    assert.equal(rank, 1);
  });

  it("excludes assignees with no endpoint or DTO signals when unassigned", () => {
    const snapshot = buildCodeInventorySnapshot({
      scanId: "scan-1",
      sourceRoot: "/repo",
      runStartedAt: new Date("2026-01-01T00:00:00Z"),
      entityArrays: {},
      linkArrays: { HttpApiContractAssignment: [] },
    });
    assert.equal(
      isEligibleForInferenceAssignee(
        { id: "ctrl-1", endpoints: ["GET /"], dataTypeIds: [] },
        snapshot,
      ),
      false,
    );
  });

  it("excludes assignees that already have HttpApiContractAssignment", () => {
    const snapshot = buildCodeInventorySnapshot({
      scanId: "scan-1",
      sourceRoot: "/repo",
      runStartedAt: new Date("2026-01-01T00:00:00Z"),
      entityArrays: {},
      linkArrays: {
        HttpApiContractAssignment: [
          {
            id: "link-1",
            contractId: "c-1",
            assigneeId: "ctrl-1",
            basis: "extract",
          },
        ],
      },
    });
    assert.equal(
      isEligibleForInferenceAssignee(
        { id: "ctrl-1", endpoints: ["GET /api/items"], dataTypeIds: [] },
        snapshot,
      ),
      false,
    );
  });
});
