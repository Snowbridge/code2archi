import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { getLogger, resolveLogFilePath } from "../../../src/platform/logging/index.js";
import { formatLogFileTimestamp } from "../../../src/platform/timestamp.js";
import { createTestTempDir } from "../../test-temp-dir.js";
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

describe("resolveLogFilePath", () => {
  it("uses UTC compact timestamp in file name", () => {
    const date = new Date(Date.UTC(2026, 7, 24, 12, 42, 1, 123));
    const dir = createTestTempDir("c2a-log-path-");
    const filePath = resolveLogFilePath(dir, date);

    assert.equal(
      path.basename(filePath),
      `code2archi-${formatLogFileTimestamp(date)}.log`,
    );
  });

  it("adds numeric suffix on collision in the same millisecond", () => {
    const date = new Date(Date.UTC(2026, 7, 24, 12, 42, 1, 123));
    const dir = createTestTempDir("c2a-log-collision-");
    const timestamp = formatLogFileTimestamp(date);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `code2archi-${timestamp}.log`), "", "utf8");

    const filePath = resolveLogFilePath(dir, date);
    assert.equal(path.basename(filePath), `code2archi-${timestamp}-2.log`);
  });
});

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
