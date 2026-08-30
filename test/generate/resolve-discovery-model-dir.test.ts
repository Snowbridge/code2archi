import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { CliError } from "../../src/cli/cli-error.js";
import { ExitCode } from "../../src/cli/exit-codes.js";
import {
  parseRunTimestamp,
  parseScanDirTimestamp,
  resolveLatestDiscoveryModelDir,
} from "../../src/generate/resolve-discovery-model-dir.js";
import { formatRunTimestamp } from "../../src/platform/timestamp.js";
import { createTestTempDir } from "../test-temp-dir.js";

describe("resolveLatestDiscoveryModelDir", () => {
  it("selects the newest code2archi-scan-* directory", () => {
    const tempDir = createTestTempDir("c2a-resolve-discovery-");
    const olderTimestamp = "2026-08-30T10-00-00.0000+0300";
    const newerTimestamp = "2026-08-30T12-00-00.0000+0300";
    mkdirSync(path.join(tempDir, `code2archi-scan-${olderTimestamp}`));
    mkdirSync(path.join(tempDir, `code2archi-scan-${newerTimestamp}`));

    const resolved = resolveLatestDiscoveryModelDir(tempDir);

    assert.equal(resolved, path.join(tempDir, `code2archi-scan-${newerTimestamp}`));
  });

  it("throws when no discovery-model directories exist", () => {
    const tempDir = createTestTempDir("c2a-resolve-discovery-empty-");
    assert.throws(
      () => resolveLatestDiscoveryModelDir(tempDir),
      (error: unknown) => {
        assert.ok(error instanceof CliError);
        assert.equal(error.exitCode, ExitCode.ARGV);
        return true;
      },
    );
  });
});

describe("parseRunTimestamp", () => {
  it("round-trips formatRunTimestamp values", () => {
    const date = new Date("2026-08-30T09:15:24.335Z");
    const formatted = formatRunTimestamp(date);
    const parsed = parseRunTimestamp(formatted);

    assert.ok(parsed);
    assert.equal(parsed!.getTime(), date.getTime());
  });

  it("parses scan directory suffix", () => {
    const timestamp = "2026-08-30T12-00-00.0000+0300";
    const parsed = parseScanDirTimestamp(`code2archi-scan-${timestamp}`);
    assert.ok(parsed);
  });
});
