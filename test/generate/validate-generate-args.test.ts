import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { CliError } from "../../src/cli/cli-error.js";
import { ExitCode } from "../../src/cli/exit-codes.js";
import { validateGenerateArgs } from "../../src/generate/validate-generate-args.js";
import { createTestTempDir } from "../test-temp-dir.js";

describe("validateGenerateArgs", () => {
  it("appends .archimate extension when missing", () => {
    const tempDir = createTestTempDir("c2a-generate-args-");
    const discoveryDir = path.join(tempDir, "discovery");
    mkdirSync(discoveryDir);
    writeFileSync(path.join(discoveryDir, "manifest.json"), "{}\n", "utf8");

    const args = validateGenerateArgs({
      outputFile: path.join(tempDir, "model"),
      discoveryModelDir: discoveryDir,
      force: false,
    });

    assert.equal(args.outputFile, path.join(tempDir, "model.archimate"));
  });

  it("rejects existing output file without force", () => {
    const tempDir = createTestTempDir("c2a-generate-args-force-");
    const discoveryDir = path.join(tempDir, "discovery");
    const outputFile = path.join(tempDir, "model.archimate");
    mkdirSync(discoveryDir);
    writeFileSync(path.join(discoveryDir, "manifest.json"), "{}\n", "utf8");
    writeFileSync(outputFile, "<xml/>\n", "utf8");

    assert.throws(
      () =>
        validateGenerateArgs({
          outputFile,
          discoveryModelDir: discoveryDir,
          force: false,
        }),
      (error: unknown) => {
        assert.ok(error instanceof CliError);
        assert.equal(error.exitCode, ExitCode.RUNTIME);
        return true;
      },
    );
  });

  it("requires manifest in discovery-model directory", () => {
    const tempDir = createTestTempDir("c2a-generate-args-manifest-");
    const discoveryDir = path.join(tempDir, "discovery");
    mkdirSync(discoveryDir);

    assert.throws(
      () =>
        validateGenerateArgs({
          outputFile: path.join(tempDir, "model.archimate"),
          discoveryModelDir: discoveryDir,
          force: false,
        }),
      /manifest not found/,
    );
  });
});
