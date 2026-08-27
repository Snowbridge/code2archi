import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { CliError } from "../src/cli/cli-error.js";
import { ExitCode } from "../src/cli/exit-codes.js";
import { resolveSourceDirs } from "../src/scan/resolve-source-dirs.js";

function expectCliError(fn: () => void, messagePart: string): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof CliError);
    assert.equal(error.exitCode, ExitCode.ARGV);
    assert.match(error.message, new RegExp(messagePart));
    return true;
  });
}

describe("resolveSourceDirs", () => {
  it("resolves multiple literal paths", () => {
    const root = mkdtempSync(path.join(tmpdir(), "c2a-src-"));
    const a = path.join(root, "a");
    const b = path.join(root, "b");
    mkdirSync(a);
    mkdirSync(b);

    const result = resolveSourceDirs([path.join(root, "a"), path.join(root, "b")]);
    assert.deepEqual(result, [a, b]);
  });

  it("reads paths from a single @file", () => {
    const root = mkdtempSync(path.join(tmpdir(), "c2a-list-"));
    const dirA = path.join(root, "repo-a");
    const dirB = path.join(root, "repo-b");
    mkdirSync(dirA);
    mkdirSync(dirB);

    const listFile = path.join(root, "sources.txt");
    writeFileSync(listFile, `${dirA}\n\n${dirB}\n`, "utf8");

    const result = resolveSourceDirs([`@${listFile}`]);
    assert.deepEqual(result, [dirA, dirB]);
  });

  it("rejects missing source-dir", () => {
    expectCliError(() => resolveSourceDirs([]), "Missing required argument");
  });

  it("rejects multiple @file arguments", () => {
    expectCliError(
      () => resolveSourceDirs(["@a.txt", "@b.txt"]),
      "Only one @file",
    );
  });

  it("rejects mixing @file with literal paths", () => {
    expectCliError(
      () => resolveSourceDirs(["@a.txt", "/tmp/foo"]),
      "Cannot mix @file",
    );
  });

  it("rejects empty list file", () => {
    const root = mkdtempSync(path.join(tmpdir(), "c2a-empty-"));
    const listFile = path.join(root, "empty.txt");
    writeFileSync(listFile, "\n  \n", "utf8");

    expectCliError(
      () => resolveSourceDirs([`@${listFile}`]),
      "list file is empty",
    );
  });
});
