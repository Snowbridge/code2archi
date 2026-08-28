import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { logCalls } from "../../../src/platform/logging/index.js";
import { withTestLogging } from "./test-logging.js";

function readSingleLogFile(dir: string): string {
  const files = readdirSync(dir).filter((name) => name.endsWith(".log"));
  assert.equal(files.length, 1);
  return readFileSync(path.join(dir, files[0]!), "utf8");
}

describe("logCalls", () => {
  it("is a no-op at INFO level", async () => {
    const tracedAdd = logCalls((a: number, b: number) => a + b, "test.sample", "add");

    const dir = await withTestLogging({ logLevel: "INFO", verbose: false }, () => {
      assert.equal(tracedAdd(1, 2), 3);
    });

    const content = readSingleLogFile(dir);
    assert.doesNotMatch(content, /enter add/);
  });

  it("logs enter and leave at DEBUG level", async () => {
    const tracedAdd = logCalls((a: number, b: number) => a + b, "processor.scan-scope.sample", "add");
    const tracedNoop = logCalls((): void => undefined, "processor.scan-scope.sample", "noop");

    const dir = await withTestLogging({ logLevel: "DEBUG", verbose: false }, () => {
      assert.equal(tracedAdd(2, 3), 5);
      tracedNoop();
    });

    const content = readSingleLogFile(dir);
    assert.match(content, /enter add/);
    assert.match(content, /leave add/);
    assert.match(content, /leave noop/);
    assert.match(content, /status=completed/);
    assert.match(content, /\[processor\.scan-scope\.sample\]/);
  });

  it("logs error and stack at DEBUG before rethrow", async () => {
    const tracedFail = logCalls((): never => {
      throw new Error("boom");
    }, "processor.scan-scope.sample", "fail");

    const dir = await withTestLogging({ logLevel: "DEBUG", verbose: false }, () => {
      assert.throws(() => tracedFail(), /boom/);
    });

    const content = readSingleLogFile(dir);
    assert.match(content, /error boom/);
    assert.match(content, /stack trace/);
  });
});
