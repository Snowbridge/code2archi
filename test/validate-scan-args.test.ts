import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { CliError } from "../src/cli/cli-error.js";
import { ExitCode } from "../src/cli/exit-codes.js";
import { validateScanArgs } from "../src/scan/validate-scan-args.js";
import { createTestTempDir, workspaceTmpDir } from "./test-temp-dir.js";

function expectCliError(
  fn: () => void,
  exitCode: ExitCode,
  messagePart: string,
): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof CliError);
    assert.equal(error.exitCode, exitCode);
    assert.match(error.message, new RegExp(messagePart));
    return true;
  });
}

describe("validateScanArgs", () => {
  const previousTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Etc/GMT-3";
  });

  afterEach(() => {
    if (previousTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTz;
    }
  });

  it("rejects non-existent source directory", () => {
    expectCliError(
      () =>
        validateScanArgs({
          sourceDirs: [path.join(workspaceTmpDir, "c2a-missing-dir")],
          force: false,
        }),
      ExitCode.ARGV,
      "does not exist",
    );
  });

  it("rejects non-empty output without force", () => {
    const root = createTestTempDir("c2a-out-");
    const sourceDir = path.join(root, "src");
    const outputDir = path.join(root, "out");
    mkdirSync(sourceDir);
    mkdirSync(outputDir);
    writeFileSync(path.join(outputDir, "manifest.json"), "{}", "utf8");

    expectCliError(
      () =>
        validateScanArgs({
          sourceDirs: [sourceDir],
          output: outputDir,
          force: false,
        }),
      ExitCode.RUNTIME,
      "not empty",
    );
  });

  it("allows non-empty output with force", () => {
    const root = createTestTempDir("c2a-force-");
    const sourceDir = path.join(root, "src");
    const outputDir = path.join(root, "out");
    mkdirSync(sourceDir);
    mkdirSync(outputDir);
    writeFileSync(path.join(outputDir, "manifest.json"), "{}", "utf8");

    const result = validateScanArgs({
      sourceDirs: [sourceDir],
      output: outputDir,
      force: true,
      now: new Date("2026-08-27T12:00:00.000Z"),
    });

    assert.equal(result.outputDir, outputDir);
    assert.equal(result.scanId, "2026-08-27T15-00-00.0000+0300");
  });

  it("uses default output directory name with timestamp", () => {
    const root = createTestTempDir("c2a-default-");
    const sourceDir = path.join(root, "src");
    mkdirSync(sourceDir);
    const previousCwd = process.cwd();
    process.chdir(root);

    try {
      const result = validateScanArgs({
        sourceDirs: [sourceDir],
        force: false,
        now: new Date("2026-08-27T09:00:45.000Z"),
      });
      assert.equal(
        result.outputDir,
        path.join(root, "code2archi-scan-2026-08-27T12-00-45.0000+0300"),
      );
      assert.equal(result.scanId, "2026-08-27T12-00-45.0000+0300");
    } finally {
      process.chdir(previousCwd);
    }
  });
});
