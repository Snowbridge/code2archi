import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendContext } from "../../../src/platform/logging/format-context.js";

describe("appendContext", () => {
  it("appends key=value pairs", () => {
    assert.equal(
      appendContext("resolved scope", { path: "/workspace", count: 12 }),
      "resolved scope path=/workspace count=12",
    );
  });

  it("returns message unchanged when context is empty", () => {
    assert.equal(appendContext("hello", {}), "hello");
    assert.equal(appendContext("hello"), "hello");
  });
});
