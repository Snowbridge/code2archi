import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "../src/platform/processors/builtin-processors.js";
import { CliError } from "../src/cli/cli-error.js";
import { ExitCode } from "../src/cli/exit-codes.js";
import { coerceLogLevel, coerceThreads } from "../src/cli/global-options.js";
import { validateGlobalArgv } from "../src/cli/validate-global-argv.js";

function baseArgv(): Record<string, unknown> {
  return {
    logLevel: "INFO",
    verbose: false,
    profile: false,
    threads: 2,
    sync: false,
    continueOnError: false,
    with: [],
    without: [],
    withOnly: [],
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
        without: ["scan.source.*"],
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
});

describe("global option coercion", () => {
  it("coerces log level case-insensitively", () => {
    assert.equal(coerceLogLevel("debug"), "DEBUG");
    assert.equal(coerceLogLevel("Info"), "INFO");
  });

  it("rejects invalid log level", () => {
    expectCliError(() => coerceLogLevel("trace"), "Invalid --log-level");
  });

  it("rejects invalid threads", () => {
    expectCliError(() => coerceThreads(0), "Invalid --threads");
    expectCliError(() => coerceThreads(1.5), "Invalid --threads");
  });
});
