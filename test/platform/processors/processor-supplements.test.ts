import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { CliError } from "../../../src/cli/cli-error.js";
import { ExitCode } from "../../../src/cli/exit-codes.js";
import {
  filterSupplementsForProcessor,
  normalizeSupplementConfigValue,
  parseSupplementToken,
  resolveProcessorSupplementCatalog,
  supplementToken,
} from "../../../src/platform/processors/processor-supplements.js";
import { createTestTempDir } from "../../test-temp-dir.js";

describe("processor supplements", () => {
  it("parses coordinate@path token", () => {
    const parsed = parseSupplementToken("scan.scope.git-repositories@.c2a/hints.txt");
    assert.equal(parsed.target, "scan.scope.git-repositories");
    assert.equal(parsed.filePath, ".c2a/hints.txt");
  });

  it("rejects token without @ separator", () => {
    assert.throws(
      () => parseSupplementToken("scan.scope.git-repositories"),
      (error: unknown) => {
        assert.ok(error instanceof CliError);
        assert.equal(error.exitCode, ExitCode.ARGV);
        return true;
      },
    );
  });

  it("normalizes flat and structured YAML values to tokens", () => {
    const tokens = normalizeSupplementConfigValue([
      "scan.scope.git-repositories@hints.txt",
      {
        target: "scan.transform.rest.client-serving",
        paths: [".c2a/contracts.txt", ".c2a/more.txt"],
      },
    ]);
    assert.deepEqual(tokens, [
      "scan.scope.git-repositories@hints.txt",
      supplementToken("scan.transform.rest.client-serving", ".c2a/contracts.txt"),
      supplementToken("scan.transform.rest.client-serving", ".c2a/more.txt"),
    ]);
  });

  it("resolves paths and filters by processor id", () => {
    const root = createTestTempDir("c2a-supplements-");
    const hintsPath = path.join(root, "hints.txt");
    writeFileSync(hintsPath, "hint", "utf8");

    const catalog = resolveProcessorSupplementCatalog(
      [supplementToken("scan.scope.*", hintsPath)],
      root,
    );

    const refs = filterSupplementsForProcessor(catalog, {
      groupId: "scan.scope",
      artifactId: "git-repositories",
    });
    assert.equal(refs.length, 1);
    assert.equal(refs[0]?.path, hintsPath);
    assert.equal(refs[0]?.basename, "hints.txt");
  });

  it("throws when supplement file is missing", () => {
    const root = createTestTempDir("c2a-supplements-missing-");
    assert.throws(
      () =>
        resolveProcessorSupplementCatalog(
          [supplementToken("scan.scope.git-repositories", path.join(root, "missing.txt"))],
          root,
        ),
      (error: unknown) => {
        assert.ok(error instanceof CliError);
        assert.equal(error.exitCode, ExitCode.ARGV);
        assert.match((error as CliError).message, /Supplement file not found/);
        return true;
      },
    );
  });

  it("returns no refs when processor id does not match target", () => {
    const root = createTestTempDir("c2a-supplements-filter-");
    const hintsPath = path.join(root, "hints.txt");
    writeFileSync(hintsPath, "hint", "utf8");

    const catalog = resolveProcessorSupplementCatalog(
      [supplementToken("scan.transform.*", hintsPath)],
      root,
    );
    const refs = filterSupplementsForProcessor(catalog, {
      groupId: "scan.scope",
      artifactId: "git-repositories",
    });
    assert.deepEqual(refs, []);
  });
});
