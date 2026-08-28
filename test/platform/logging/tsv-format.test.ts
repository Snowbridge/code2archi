import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { getLogger } from "../../../src/platform/logging/index.js";
import { withTestLogging } from "./test-logging.js";

function readSingleLogFile(dir: string): string {
  const files = readdirSync(dir).filter((name) => name.endsWith(".log"));
  assert.equal(files.length, 1);
  return readFileSync(path.join(dir, files[0]!), "utf8");
}

describe("initLogging TSV format", () => {
  it("writes four tab-separated fields with lowercase level and bracketed logger name", async () => {
    const dir = await withTestLogging({ logLevel: "INFO", verbose: false }, () => {
      getLogger("scan.flow").info("step start", { step: 1 });
    });

    const line = readSingleLogFile(dir)
      .split(/\r?\n/)
      .find((entry) => entry.includes("step start"))!;
    const parts = line.split("\t");
    assert.equal(parts.length, 4);
    assert.match(
      parts[0]!,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/,
    );
    assert.equal(parts[1], "info");
    assert.equal(parts[2], "[scan.flow]");
    assert.match(parts[3]!, /step start step=1/);
  });

  it("escapes special characters in message", async () => {
    const dir = await withTestLogging({ logLevel: "INFO", verbose: false }, () => {
      getLogger("test").info("line1\nline2\ttab");
    });

    const content = readSingleLogFile(dir);
    assert.match(content, /line1\\nline2\\ttab/);
  });
});
