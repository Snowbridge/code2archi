import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEntityId } from "../../src/utils/discovery-model-entities.js";

describe("createEntityId", () => {
  it("returns deterministic sha256 hex", () => {
    const keys = ["https://github.com/example/repo.git", "/workspace/my-app"];
    const first = createEntityId(keys);
    const second = createEntityId(keys);

    assert.equal(first, second);
    assert.match(first, /^[a-f0-9]{64}$/);
  });

  it("changes when url is empty but localPath differs", () => {
    const a = createEntityId(["", "/workspace/a"]);
    const b = createEntityId(["", "/workspace/b"]);
    assert.notEqual(a, b);
  });
});
