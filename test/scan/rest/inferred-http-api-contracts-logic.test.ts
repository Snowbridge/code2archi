import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeClientControllerRank,
  isEffectivelyEmptyEndpoints,
  isEligibleRestEndpointEntity,
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

  it("excludes entities with empty contracts and no signals", () => {
    assert.equal(
      isEligibleRestEndpointEntity({
        contractIds: [],
        endpoints: ["GET /"],
        dataTypeIds: [],
      }),
      false,
    );
  });
});
