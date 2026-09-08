import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  businessEndpointsFrom,
  isInfrastructureEndpoint,
  isInfrastructureEndpointString,
  parseHttpEndpoint,
} from "../../src/generate/rest-controller-elements.js";

describe("rest-controller-elements", () => {
  it("parses HTTP endpoint strings", () => {
    assert.deepEqual(parseHttpEndpoint("GET /api/users"), {
      method: "GET",
      path: "/api/users",
    });
    assert.equal(parseHttpEndpoint("INVALID"), undefined);
  });

  it("detects infrastructure endpoints for GET only", () => {
    assert.equal(isInfrastructureEndpoint("GET", "/"), true);
    assert.equal(isInfrastructureEndpoint("GET", "/management/health"), true);
    assert.equal(isInfrastructureEndpoint("GET", "/actuator/info"), true);
    assert.equal(isInfrastructureEndpoint("POST", "/actuator/info"), false);
    assert.equal(isInfrastructureEndpoint("GET", "/api/users"), false);
  });

  it("filters business endpoints and sorts lexicographically", () => {
    assert.deepEqual(
      businessEndpointsFrom([
        "POST /api/items",
        "GET /actuator/health",
        "GET /api/users",
        "GET /",
      ]),
      ["GET /api/users", "POST /api/items"],
    );
  });

  it("detects infrastructure endpoint strings", () => {
    assert.equal(isInfrastructureEndpointString("GET /management/metrics"), true);
    assert.equal(isInfrastructureEndpointString("GET /api"), false);
  });
});
