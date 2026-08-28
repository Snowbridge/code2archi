import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { resolveLogFilePath } from "../../../src/platform/logging/resolve-log-file-path.js";
import { formatLogFileTimestamp } from "../../../src/platform/timestamp.js";
import { createTestTempDir } from "../../test-temp-dir.js";

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
