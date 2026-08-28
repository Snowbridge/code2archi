import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escapeMessage } from "../../../src/platform/logging/escape-message.js";

describe("escapeMessage", () => {
  it("escapes tab, newline and backslash", () => {
    assert.equal(escapeMessage("a\tb"), "a\\tb");
    assert.equal(escapeMessage("a\nb"), "a\\nb");
    assert.equal(escapeMessage("a\\b"), "a\\\\b");
    assert.equal(escapeMessage("a\rb"), "a\\nb");
  });

  it("preserves other characters including cyrillic", () => {
    assert.equal(escapeMessage("привет"), "привет");
  });
});
