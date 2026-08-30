import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createModelId,
  createProfileId,
  createRootFolderId,
} from "../../src/archimate-model/create-archi-id.js";

describe("createArchiId helpers", () => {
  it("creates stable sha256 ids", () => {
    const first = createRootFolderId("business");
    const second = createRootFolderId("business");
    assert.equal(first, second);
    assert.match(first, /^[0-9a-f]{64}$/);
  });

  it("creates distinct ids for different kinds", () => {
    assert.notEqual(createRootFolderId("business"), createRootFolderId("application"));
    assert.notEqual(createProfileId("Artifact", "Git repo"), createRootFolderId("business"));
    assert.notEqual(createModelId("/tmp/a.archimate"), createModelId("/tmp/b.archimate"));
  });
});
