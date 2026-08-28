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

describe("log level filter", () => {
  it("does not write debug records when log level is INFO", async () => {
    const dir = await withTestLogging({ logLevel: "INFO", verbose: false }, () => {
      const logger = getLogger("test.logger");
      logger.info("visible info");
      logger.warn("visible warn");
      logger.debug("hidden debug");
    });

    const content = readSingleLogFile(dir);
    assert.match(content, /visible info/);
    assert.match(content, /visible warn/);
    assert.doesNotMatch(content, /hidden debug/);
  });

  it("writes debug records when log level is DEBUG", async () => {
    const dir = await withTestLogging({ logLevel: "DEBUG", verbose: false }, () => {
      getLogger("test.logger").debug("visible debug");
    });

    const content = readSingleLogFile(dir);
    assert.match(content, /visible debug/);
  });
});
