import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
    withNone: [],
    withScanScope: [],
    withScanTech: [],
    withScanApp: [],
    withGenerateBiz: [],
    withGenerateApp: [],
    withGenerateTech: [],
    withGenerateRel: [],
    withGenerateView: [],
    withoutScanScope: [],
    withoutScanTech: [],
    withoutScanApp: [],
    withoutGenerateBiz: [],
    withoutGenerateApp: [],
    withoutGenerateTech: [],
    withoutGenerateRel: [],
    withoutGenerateView: [],
    withOnlyScanScope: [],
    withOnlyScanTech: [],
    withOnlyScanApp: [],
    withOnlyGenerateBiz: [],
    withOnlyGenerateApp: [],
    withOnlyGenerateTech: [],
    withOnlyGenerateRel: [],
    withOnlyGenerateView: [],
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
        withNone: ["scan-app"],
        withOnlyScanTech: ["build-system-npm-workspace"],
      }),
    );
  });

  it("rejects unknown groupId in --with-none", () => {
    expectCliError(
      () =>
        validateGlobalArgv({
          ...baseArgv(),
          withNone: ["unknown-group"],
        }),
      'Invalid --with-none groupId: "unknown-group"',
    );
  });

  it("rejects --with-none with --with-only for the same group", () => {
    expectCliError(
      () =>
        validateGlobalArgv({
          ...baseArgv(),
          withNone: ["scan-app"],
          withOnlyScanApp: ["processor-a"],
        }),
      'Conflicting processor filters for group "scan-app"',
    );
  });

  it("rejects --with-only with --without for the same group", () => {
    expectCliError(
      () =>
        validateGlobalArgv({
          ...baseArgv(),
          withOnlyScanTech: ["processor-a"],
          withoutScanTech: ["processor-b"],
        }),
      'Conflicting processor filters for group "scan-tech"',
    );
  });

  it("rejects --with-none with --without for the same group", () => {
    expectCliError(
      () =>
        validateGlobalArgv({
          ...baseArgv(),
          withNone: ["scan-scope"],
          withoutScanScope: ["processor-a"],
        }),
      'Conflicting processor filters for group "scan-scope"',
    );
  });

  it("rejects --with-none with --with for the same group", () => {
    expectCliError(
      () =>
        validateGlobalArgv({
          ...baseArgv(),
          withNone: ["scan-scope"],
          withScanScope: ["unversioned-folders"],
        }),
      'Conflicting processor filters for group "scan-scope"',
    );
  });

  it("rejects --with-only with --with for the same group", () => {
    expectCliError(
      () =>
        validateGlobalArgv({
          ...baseArgv(),
          withOnlyScanScope: ["git-repos"],
          withScanScope: ["unversioned-folders"],
        }),
      'Conflicting processor filters for group "scan-scope"',
    );
  });

  it("rejects the same artifactId in --with and --without", () => {
    expectCliError(
      () =>
        validateGlobalArgv({
          ...baseArgv(),
          withScanScope: ["unversioned-folders"],
          withoutScanScope: ["unversioned-folders"],
        }),
      'both list "unversioned-folders"',
    );
  });

  it("allows conflicting filters across different groups", () => {
    assert.doesNotThrow(() =>
      validateGlobalArgv({
        ...baseArgv(),
        withNone: ["scan-app"],
        withoutScanTech: ["processor-a"],
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
