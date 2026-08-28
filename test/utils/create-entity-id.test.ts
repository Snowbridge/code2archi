import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createEntityId } from "../../src/utils/discovery-model-entities.js";
import { withTestLogging } from "../platform/logging/test-logging.js";

function readSingleLogFile(dir: string): string {
  const files = readdirSync(dir).filter((name) => name.endsWith(".log"));
  assert.equal(files.length, 1);
  return readFileSync(path.join(dir, files[0]!), "utf8");
}

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

  it("logs hash and natural keys at DEBUG log level", async () => {
    const keys = ["", "/workspace/my-app"];
    let hash = "";
    const dir = await withTestLogging({ logLevel: "DEBUG", verbose: false }, () => {
      hash = createEntityId(keys);
    });

    const content = readSingleLogFile(dir);
    assert.match(content, /entity id computed/);
    assert.match(content, new RegExp(`hash=${hash}`));
    assert.match(content, /input=:\/workspace\/my-app/);
    assert.match(content, /naturalKeys=\["","\/workspace\/my-app"\]/);
  });
});
