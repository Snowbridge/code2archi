import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRepositoryId } from "../../../src/processors/scan-scope/create-repository-id.js";

describe("createRepositoryId", () => {
  it("returns deterministic sha256 hex", () => {
    const first = createRepositoryId(
      "https://github.com/example/repo.git",
      "/workspace/my-app",
    );
    const second = createRepositoryId(
      "https://github.com/example/repo.git",
      "/workspace/my-app",
    );

    assert.equal(first, second);
    assert.match(first, /^[a-f0-9]{64}$/);
  });

  it("changes when url is empty but localPath differs", () => {
    const a = createRepositoryId("", "/workspace/a");
    const b = createRepositoryId("", "/workspace/b");
    assert.notEqual(a, b);
  });
});
