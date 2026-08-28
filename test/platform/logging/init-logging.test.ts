import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { getLogger } from "../../../src/platform/logging/index.js";
import { formatLogFileTimestamp } from "../../../src/platform/timestamp.js";
import { withTestLogging } from "./test-logging.js";

function readSingleLogFile(dir: string): string {
  const files = readdirSync(dir).filter((name) => name.endsWith(".log"));
  assert.equal(files.length, 1);
  return readFileSync(path.join(dir, files[0]!), "utf8");
}

describe("initLogging", () => {
  it("creates log file in configured directory", async () => {
    const dir = await withTestLogging({ logLevel: "INFO", verbose: false }, () => {
      getLogger("cli.scan").info("command start");
    });

    const files = readdirSync(dir).filter((name) => name.endsWith(".log"));
    assert.equal(files.length, 1);
    assert.match(
      files[0]!,
      new RegExp(`^code2archi-${formatLogFileTimestamp(new Date()).slice(0, 8)}`),
    );
    assert.match(readSingleLogFile(dir), /command start/);
  });
});
