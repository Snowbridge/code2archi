import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterMeaningfulEndpoints,
  hasMeaningfulEndpoints,
  isInfrastructureEndpoint,
} from "../../src/generate/rest-infrastructure-endpoints.js";

describe("isInfrastructureEndpoint", () => {
  it("matches GET / exactly", () => {
    assert.equal(isInfrastructureEndpoint("GET /"), true);
    assert.equal(isInfrastructureEndpoint("GET /api"), false);
  });

  it("matches GET /management/* prefix paths", () => {
    assert.equal(isInfrastructureEndpoint("GET /management/health"), true);
    assert.equal(isInfrastructureEndpoint("GET /management/metrics"), true);
    assert.equal(isInfrastructureEndpoint("GET /management"), false);
    assert.equal(isInfrastructureEndpoint("GET /management-extra"), false);
  });

  it("matches GET /actuator/* prefix paths", () => {
    assert.equal(isInfrastructureEndpoint("GET /actuator/health"), true);
    assert.equal(isInfrastructureEndpoint("GET /actuator/metrics"), true);
    assert.equal(isInfrastructureEndpoint("GET /actuator"), false);
  });

  it("does not match other methods on infrastructure paths", () => {
    assert.equal(isInfrastructureEndpoint("POST /actuator/health"), false);
    assert.equal(isInfrastructureEndpoint("POST /"), false);
  });

  it("does not match business endpoints", () => {
    assert.equal(isInfrastructureEndpoint("GET /lots"), false);
    assert.equal(isInfrastructureEndpoint("POST /api/payments"), false);
  });
});

describe("hasMeaningfulEndpoints", () => {
  it("returns false when only infrastructure endpoints are present", () => {
    assert.equal(
      hasMeaningfulEndpoints(["GET /", "GET /actuator/health", "GET /management/info"]),
      false,
    );
  });

  it("returns true when at least one meaningful endpoint exists", () => {
    assert.equal(hasMeaningfulEndpoints(["GET /", "GET /lots"]), true);
  });
});

describe("filterMeaningfulEndpoints", () => {
  it("returns sorted meaningful endpoints only", () => {
    assert.deepEqual(
      filterMeaningfulEndpoints([
        "POST /lots",
        "GET /",
        "GET /actuator/health",
        "GET /lots",
      ]),
      ["GET /lots", "POST /lots"],
    );
  });
});
