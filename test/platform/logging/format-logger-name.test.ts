import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatLoggerName } from "../../../src/platform/logging/format-logger-name.js";

describe("formatLoggerName", () => {
  it("wraps name in brackets", () => {
    assert.equal(formatLoggerName("scan.flow"), "[scan.flow]");
  });
});
