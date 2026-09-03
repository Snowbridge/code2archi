import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchesGroupPattern,
  validateGroupPattern,
} from "../../../src/platform/processors/processor-coordinate.js";

describe("validateGroupPattern", () => {
  it("accepts exact groupId literals", () => {
    assert.doesNotThrow(() => validateGroupPattern("scan.scope"));
    assert.doesNotThrow(() => validateGroupPattern("generate.elements.application"));
  });

  it("accepts wildcard suffix", () => {
    assert.doesNotThrow(() => validateGroupPattern("generate.elements.*"));
  });

  it("rejects empty pattern", () => {
    assert.throws(() => validateGroupPattern(""), /must not be empty/);
  });

  it("rejects lone wildcard", () => {
    assert.throws(() => validateGroupPattern(".*"), /Invalid processor group pattern/);
  });

  it("rejects star not at suffix", () => {
    assert.throws(() => validateGroupPattern("scan.*.scope"), /Invalid processor group pattern/);
  });
});

describe("matchesGroupPattern", () => {
  it("matches exact groupId literal", () => {
    assert.equal(matchesGroupPattern("scan.scope", "scan.scope"), true);
    assert.equal(matchesGroupPattern("scan.source", "scan.scope"), false);
  });

  it("does not treat coordinate-like pattern as processor coordinate", () => {
    assert.equal(matchesGroupPattern("scan.scope", "scan.scope.git-repositories"), false);
    assert.equal(matchesGroupPattern("scan.scope.git-repositories", "scan.scope.git-repositories"), true);
  });

  it("matches wildcard prefix and subgroups", () => {
    assert.equal(matchesGroupPattern("generate.elements", "generate.elements.*"), true);
    assert.equal(matchesGroupPattern("generate.elements.application", "generate.elements.*"), true);
    assert.equal(matchesGroupPattern("generate.views", "generate.elements.*"), false);
  });

  it("exact pattern excludes subgroups", () => {
    assert.equal(matchesGroupPattern("generate.elements.application", "generate.elements.application"), true);
    assert.equal(
      matchesGroupPattern("generate.elements.application.rest", "generate.elements.application"),
      false,
    );
  });
});
