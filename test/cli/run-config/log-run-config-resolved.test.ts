import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { logBootstrapStartup } from "../../../src/cli/run-config/log-run-config-resolved.js";
import { withTestLogging } from "../../platform/logging/test-logging.js";

function readSingleLogFile(dir: string): string {
  const files = readdirSync(dir).filter((name) => name.endsWith(".log"));
  assert.equal(files.length, 1);
  return readFileSync(path.join(dir, files[0]!), "utf8");
}

describe("logRunConfigResolved", () => {
  it("writes INFO run-config resolved with path and name", async () => {
    const dir = await withTestLogging({ logLevel: "INFO", verbose: false }, () => {
      logBootstrapStartup(
        {
          path: "/tmp/custom/code2archi.yaml",
          name: "code2archi.yaml",
          loaded: true,
        },
        ["scan", "/src"],
      );
    });

    const content = readSingleLogFile(dir);
    assert.match(content, /run-config resolved/);
    assert.match(content, /path=\/tmp\/custom\/code2archi.yaml/);
    assert.match(content, /name=code2archi.yaml/);
    assert.match(content, /\[cli.bootstrap\]/);
  });

  it("logs none when config is not loaded", async () => {
    const dir = await withTestLogging({ logLevel: "INFO", verbose: false }, () => {
      logBootstrapStartup({ path: "none", name: "none", loaded: false }, [
        "generate",
        "out.archimate",
      ]);
    });

    const content = readSingleLogFile(dir);
    assert.match(content, /path=none/);
    assert.match(content, /name=none/);
  });

  it("logs full command line for bootstrap identification", async () => {
    const argv = ["scan", "/src", "--continue-on-error"];
    const dir = await withTestLogging({ logLevel: "INFO", verbose: false }, () => {
      logBootstrapStartup({ path: "none", name: "none", loaded: false }, argv);
    });

    const content = readSingleLogFile(dir);
    assert.match(content, /command line/);
    assert.match(content, /commandLine=code2archi scan \/src --continue-on-error/);
  });
});
