import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { logRunConfigResolved } from "../../../src/cli/run-config/log-run-config-resolved.js";
import { withTestLogging } from "../../platform/logging/test-logging.js";

function readSingleLogFile(dir: string): string {
  const files = readdirSync(dir).filter((name) => name.endsWith(".log"));
  assert.equal(files.length, 1);
  return readFileSync(path.join(dir, files[0]!), "utf8");
}

describe("logRunConfigResolved", () => {
  it("writes INFO run-config resolved with path and name", async () => {
    const dir = await withTestLogging({ logLevel: "INFO", verbose: false }, () => {
      logRunConfigResolved({
        path: "/tmp/custom/code2archi.yaml",
        name: "code2archi.yaml",
        loaded: true,
      });
    });

    const content = readSingleLogFile(dir);
    assert.match(content, /run-config resolved/);
    assert.match(content, /path=\/tmp\/custom\/code2archi.yaml/);
    assert.match(content, /name=code2archi.yaml/);
    assert.match(content, /\[cli.bootstrap\]/);
  });

  it("logs none when config is not loaded", async () => {
    const dir = await withTestLogging({ logLevel: "INFO", verbose: false }, () => {
      logRunConfigResolved({ path: "none", name: "none", loaded: false });
    });

    const content = readSingleLogFile(dir);
    assert.match(content, /path=none/);
    assert.match(content, /name=none/);
  });
});
