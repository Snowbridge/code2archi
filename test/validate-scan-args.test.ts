import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { CliError } from "../src/cli/cli-error.js";
import { ExitCode } from "../src/cli/exit-codes.js";
import { validateScanArgs } from "../src/scan/validate-scan-args.js";

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
  it("rejects non-existent source directory", () => {
    expectCliError(
      () =>
        validateScanArgs({
          sourceDirs: [path.join(tmpdir(), "c2a-missing-dir")],
          noTraverse: false,
          force: false,
        }),
      ExitCode.ARGV,
      "does not exist",
    );
  });

  it("rejects non-empty output without force", () => {
    const root = mkdtempSync(path.join(tmpdir(), "c2a-out-"));
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
          noTraverse: false,
          force: false,
        }),
      ExitCode.RUNTIME,
      "not empty",
    );
  });

  it("allows non-empty output with force", () => {
    const root = mkdtempSync(path.join(tmpdir(), "c2a-force-"));
    const sourceDir = path.join(root, "src");
    const outputDir = path.join(root, "out");
    mkdirSync(sourceDir);
    mkdirSync(outputDir);
    writeFileSync(path.join(outputDir, "manifest.json"), "{}", "utf8");

    const result = validateScanArgs({
      sourceDirs: [sourceDir],
      output: outputDir,
      noTraverse: false,
      force: true,
      now: new Date("2026-08-27T12:00:00.000Z"),
    });

    assert.equal(result.outputDir, outputDir);
  });

  it("uses default output directory name with timestamp", () => {
    const root = mkdtempSync(path.join(tmpdir(), "c2a-default-"));
    const sourceDir = path.join(root, "src");
    mkdirSync(sourceDir);
    const previousCwd = process.cwd();
    process.chdir(root);

    try {
      const result = validateScanArgs({
        sourceDirs: [sourceDir],
        noTraverse: false,
        force: false,
        now: new Date("2026-08-27T12:00:45.000Z"),
      });
      assert.equal(
        result.outputDir,
        path.join(root, "code2archi-scan-20260827T120045Z"),
      );
    } finally {
      process.chdir(previousCwd);
    }
  });
});
