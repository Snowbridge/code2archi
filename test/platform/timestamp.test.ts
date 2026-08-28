import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatLogFileTimestamp,
  formatLogRecordTimestamp,
  formatIso8601WithOffset,
} from "../../src/platform/timestamp.js";

describe("timestamp logging helpers", () => {
  it("formatLogFileTimestamp uses compact UTC", () => {
    const date = new Date(Date.UTC(2026, 7, 24, 12, 42, 1, 123));
    assert.equal(formatLogFileTimestamp(date), "20260824T124201123");
  });

  it("formatLogRecordTimestamp matches ISO with offset", () => {
    const date = new Date("2026-08-24T12:42:01.123Z");
    assert.equal(formatLogRecordTimestamp(date), formatIso8601WithOffset(date));
  });
});
