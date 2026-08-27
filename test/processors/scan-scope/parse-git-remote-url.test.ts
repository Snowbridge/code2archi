import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGitRemoteUrlFromOutput } from "../../../src/processors/scan-scope/parse-git-remote-url.js";

describe("parseGitRemoteUrlFromOutput", () => {
  it("prefers origin remote", () => {
    const url = parseGitRemoteUrlFromOutput(
      [
        "upstream\thttps://github.com/upstream/repo.git (fetch)",
        "origin\thttps://github.com/origin/repo.git (fetch)",
        "origin\thttps://github.com/origin/repo.git (push)",
      ].join("\n"),
      "",
    );

    assert.equal(url, "https://github.com/origin/repo.git");
  });

  it("falls back to first remote when origin is missing", () => {
    const url = parseGitRemoteUrlFromOutput(
      "upstream\thttps://github.com/upstream/repo.git (fetch)\n",
      "",
    );

    assert.equal(url, "https://github.com/upstream/repo.git");
  });

  it("returns empty string for not a git repository", () => {
    const url = parseGitRemoteUrlFromOutput(
      "",
      "fatal: not a git repository (or any of the parent directories): .git",
    );

    assert.equal(url, "");
  });

  it("returns empty string when stdout is empty", () => {
    assert.equal(parseGitRemoteUrlFromOutput("", ""), "");
  });
});
