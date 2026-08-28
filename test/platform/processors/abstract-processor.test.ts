import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { AbstractProcessor } from "../../../src/platform/processors/processor.js";
import { withTestLogging } from "../logging/test-logging.js";

function readSingleLogFile(dir: string): string {
  const files = readdirSync(dir).filter((name) => name.endsWith(".log"));
  assert.equal(files.length, 1);
  return readFileSync(path.join(dir, files[0]!), "utf8");
}

class EchoProcessor extends AbstractProcessor<string, string> {
  readonly id = { groupId: "scan-scope" as const, artifactId: "echo" };

  readonly version = "0.0.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description = "Echo processor for tests.";

  protected doProcess(input: string): string {
    return input;
  }
}

describe("AbstractProcessor", () => {
  it("writes DEBUG enter/leave via process() at DEBUG log level", async () => {
    const dir = await withTestLogging({ logLevel: "DEBUG", verbose: false }, () => {
      assert.equal(new EchoProcessor().process("hello"), "hello");
    });

    const content = readSingleLogFile(dir);
    assert.match(content, /enter process/);
    assert.match(content, /leave process/);
    assert.match(content, /\[processor\.scan-scope\.echo\]/);
  });

  it("does not write DEBUG trace at INFO log level", async () => {
    const dir = await withTestLogging({ logLevel: "INFO", verbose: false }, () => {
      assert.equal(new EchoProcessor().process("hello"), "hello");
    });

    const content = readSingleLogFile(dir);
    assert.doesNotMatch(content, /enter process/);
  });
});
