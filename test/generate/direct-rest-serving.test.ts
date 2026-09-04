import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectBestDirectRestServingMatches } from "../../src/generate/direct-rest-serving.js";

describe("selectBestDirectRestServingMatches", () => {
  it("keeps one winner per module pair with highest confidenceScore", () => {
    const winners = selectBestDirectRestServingMatches([
      {
        id: "link-endpoint",
        sourceApplicationModuleId: "mod-server",
        targetApplicationModuleId: "mod-client",
        matchMethod: "ENDPOINT",
        confidence: "inferred",
        confidenceScore: 0.4,
      },
      {
        id: "link-dto",
        sourceApplicationModuleId: "mod-server",
        targetApplicationModuleId: "mod-client",
        matchMethod: "DTO",
        confidence: "inferred",
        confidenceScore: 0.7,
      },
      {
        id: "link-interface",
        sourceApplicationModuleId: "mod-server",
        targetApplicationModuleId: "mod-client",
        matchMethod: "INTERFACE",
        confidence: "confirmed",
        confidenceScore: 1,
      },
    ]);

    assert.equal(winners.length, 1);
    assert.equal(winners[0]?.matchMethod, "INTERFACE");
  });

  it("breaks equal scores by matchMethod priority", () => {
    const winners = selectBestDirectRestServingMatches([
      {
        id: "link-endpoint",
        sourceApplicationModuleId: "mod-server",
        targetApplicationModuleId: "mod-client",
        matchMethod: "ENDPOINT",
        confidence: "inferred",
        confidenceScore: 0.7,
      },
      {
        id: "link-dto",
        sourceApplicationModuleId: "mod-server",
        targetApplicationModuleId: "mod-client",
        matchMethod: "DTO",
        confidence: "inferred",
        confidenceScore: 0.7,
      },
    ]);

    assert.equal(winners.length, 1);
    assert.equal(winners[0]?.matchMethod, "DTO");
  });
});
