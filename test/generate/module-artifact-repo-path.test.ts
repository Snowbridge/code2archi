import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { moduleArtifactRepoPathValue } from "../../src/generate/module-artifact-repo-path.js";

describe("moduleArtifactRepoPathValue", () => {
  it("omits repoPath suffix when module repoPath is empty", () => {
    assert.equal(moduleArtifactRepoPathValue("fuzz/bar", "flow-app", ""), "fuzz/bar/flow-app");
  });

  it("appends ://repoPath when module repoPath is non-empty", () => {
    assert.equal(
      moduleArtifactRepoPathValue("fuzz/bar", "flow-app", "service"),
      "fuzz/bar/flow-app://service",
    );
    assert.equal(moduleArtifactRepoPathValue("", "demo", "."), "/demo://.");
  });
});
