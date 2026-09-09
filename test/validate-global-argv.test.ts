import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "../src/platform/processors/builtin-processors.js";
import { CliError } from "../src/cli/cli-error.js";
import { ExitCode } from "../src/cli/exit-codes.js";
import { coerceThreads } from "../src/cli/global-options.js";
import { validateGlobalArgv } from "../src/cli/validate-global-argv.js";

function baseArgv(): Record<string, unknown> {
  return {
    debug: false,
    verbose: false,
    profile: false,
    threads: 2,
    sync: false,
    continueOnError: false,
    with: [],
    without: [],
    withOnly: [],
    supplement: [],
  };
}

function expectCliError(fn: () => void, messagePart: string): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof CliError);
    assert.equal(error.exitCode, ExitCode.ARGV);
    assert.match(error.message, new RegExp(messagePart));
    return true;
  });
}

describe("validateGlobalArgv", () => {
  it("accepts valid processor filter combinations", () => {
    assert.doesNotThrow(() =>
      validateGlobalArgv({
        ...baseArgv(),
        without: ["scan.extract.*"],
        withOnly: ["scan.scope.git-repositories"],
      }),
    );
  });

  it("rejects unknown processor coordinate", () => {
    expectCliError(
      () =>
        validateGlobalArgv({
          ...baseArgv(),
          with: ["scan.scope.unknown-processor"],
        }),
      'Unknown processor coordinate: "scan.scope.unknown-processor"',
    );
  });

  it("rejects --with-only with --with", () => {
    expectCliError(
      () =>
        validateGlobalArgv({
          ...baseArgv(),
          withOnly: ["scan.scope.git-repositories"],
          with: ["scan.scope.unversioned-folders"],
        }),
      "--with-only and --with cannot be used together",
    );
  });

  it("rejects the same coordinate in --with and --without", () => {
    expectCliError(
      () =>
        validateGlobalArgv({
          ...baseArgv(),
          with: ["scan.scope.unversioned-folders"],
          without: ["scan.scope.unversioned-folders"],
        }),
      'both list "scan.scope.unversioned-folders"',
    );
  });

  it("rejects invalid wildcard pattern", () => {
    expectCliError(
      () =>
        validateGlobalArgv({
          ...baseArgv(),
          without: ["scan.*.source"],
        }),
      'Invalid processor filter pattern',
    );
  });

  it("allows wildcard patterns without registry lookup", () => {
    assert.doesNotThrow(() =>
      validateGlobalArgv({
        ...baseArgv(),
        without: ["generate.elements.*"],
      }),
    );
  });

  it("normalizes --without none to empty array", () => {
    const argv = {
      ...baseArgv(),
      without: ["none"],
    };
    validateGlobalArgv(argv);
    assert.deepEqual(argv.without, []);
  });

  it("rejects none mixed with coordinates", () => {
    expectCliError(
      () =>
        validateGlobalArgv({
          ...baseArgv(),
          without: ["scan.extract.*", "none"],
        }),
      '"none" cannot be combined with other values',
    );
  });

  it("rejects invalid --supplement format", () => {
    expectCliError(
      () =>
        validateGlobalArgv({
          ...baseArgv(),
          supplement: ["scan.scope.git-repositories"],
        }),
      "expected <coordinate>@<path>",
    );
  });

  it("accepts valid --supplement token", () => {
    const argv = {
      ...baseArgv(),
      supplement: ["scan.scope.git-repositories@.c2a/hints.txt"],
    };
    validateGlobalArgv(argv);
    assert.deepEqual(argv.supplement, ["scan.scope.git-repositories@.c2a/hints.txt"]);
  });
});

describe("global option coercion", () => {
  it("rejects invalid threads", () => {
    expectCliError(() => coerceThreads(0), "Invalid --threads");
    expectCliError(() => coerceThreads(1.5), "Invalid --threads");
  });
});
