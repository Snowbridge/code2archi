import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCliCommandLine,
  formatUserCliCommandLine,
  shellQuoteCliArg,
} from "../../src/cli/format-cli-command-line.js";

describe("formatCliCommandLine", () => {
  it("prefixes user args with code2archi", () => {
    assert.equal(
      formatCliCommandLine(["node", "dist/index.js", "scan", "/src", "--threads", "10"]),
      "code2archi scan /src --threads 10",
    );
  });

  it("quotes arguments with spaces", () => {
    assert.equal(
      formatCliCommandLine([
        "node",
        "dist/index.js",
        "scan",
        "/path with spaces/src",
        "--output",
        "/out dir",
      ]),
      'code2archi scan "/path with spaces/src" --output "/out dir"',
    );
  });

  it("returns code2archi when no user args are present", () => {
    assert.equal(formatCliCommandLine(["node", "dist/index.js"]), "code2archi");
  });
});

describe("formatUserCliCommandLine", () => {
  it("formats hideBin-style argv without slicing node and script path", () => {
    assert.equal(
      formatUserCliCommandLine(["generate", "bg-api-limit", "--force"]),
      "code2archi generate bg-api-limit --force",
    );
  });
});

describe("shellQuoteCliArg", () => {
  it("leaves simple args unquoted", () => {
    assert.equal(shellQuoteCliArg("--threads"), "--threads");
    assert.equal(shellQuoteCliArg("10"), "10");
  });

  it("quotes args with spaces and escapes embedded quotes", () => {
    assert.equal(shellQuoteCliArg("a b"), '"a b"');
    assert.equal(shellQuoteCliArg('say "hi"'), '"say \\"hi\\""');
  });
});
