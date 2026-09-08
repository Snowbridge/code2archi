import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finalizePoolErrorsAfterMerge, throwOnPoolErrors } from "../../../src/platform/processors/parallel-group-runner.js";
import { initLogging, resetLoggingForTests } from "../../../src/platform/logging/index.js";
import { createTestTempDir } from "../../test-temp-dir.js";

describe("throwOnPoolErrors", () => {
  it("does nothing when errors map is empty", () => {
    throwOnPoolErrors("test.pool", new Map(), false);
    throwOnPoolErrors("test.pool", new Map(), true);
  });

  it("throws first error when continueOnError is false", () => {
    const errors = new Map<string, Error>([
      ["task-1", new Error("first failure")],
      ["task-2", new Error("second failure")],
    ]);

    assert.throws(
      () => throwOnPoolErrors("test.pool", errors, false),
      (error: unknown) => error instanceof Error && error.message === "first failure",
    );
  });

  it("logs and does not throw when continueOnError is true", () => {
    const logDir = createTestTempDir("c2a-pool-errors-");
    initLogging({ logLevel: "INFO", verbose: false, logDirectory: logDir });

    try {
      const errors = new Map<string, Error>([
        ["task-1", new Error("first failure")],
        ["task-2", new Error("second failure")],
      ]);

      throwOnPoolErrors("test.pool", errors, true);
    } finally {
      resetLoggingForTests();
    }
  });

  it("throws aggregate error after merge when continueOnError is true", () => {
    const errors = new Map<string, Error>([["task-1", new Error("first failure")]]);

    assert.throws(
      () => finalizePoolErrorsAfterMerge("test.pool", errors, true),
      (error: unknown) => error instanceof AggregateError,
    );
  });

  it("does not throw finalize when continueOnError is false", () => {
    const errors = new Map<string, Error>([["task-1", new Error("first failure")]]);

    finalizePoolErrorsAfterMerge("test.pool", errors, false);
  });
});
