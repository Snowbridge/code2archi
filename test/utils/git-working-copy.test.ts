import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { GitWorkingCopy } from "../../src/utils/git-working-copy.js";
import { createTestTempDir } from "../test-temp-dir.js";

function createGitRepo(dir: string): void {
  mkdirSync(path.join(dir, ".git"), { recursive: true });
}

describe("GitWorkingCopy.parseRemoteUrlFromOutput", () => {
  it("prefers origin remote", () => {
    const url = GitWorkingCopy.parseRemoteUrlFromOutput(
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
    const url = GitWorkingCopy.parseRemoteUrlFromOutput(
      "upstream\thttps://github.com/upstream/repo.git (fetch)\n",
      "",
    );

    assert.equal(url, "https://github.com/upstream/repo.git");
  });

  it("returns empty string for not a git repository", () => {
    const url = GitWorkingCopy.parseRemoteUrlFromOutput(
      "",
      "fatal: not a git repository (or any of the parent directories): .git",
    );

    assert.equal(url, "");
  });

  it("returns empty string when stdout is empty", () => {
    assert.equal(GitWorkingCopy.parseRemoteUrlFromOutput("", ""), "");
  });
});

describe("GitWorkingCopy.findRepoRootsInSourceDirs", () => {
  it("finds a single repository root", () => {
    const root = createTestTempDir("c2a-git-");
    const repo = path.join(root, "my-app");
    mkdirSync(repo, { recursive: true });
    createGitRepo(repo);

    const result = GitWorkingCopy.findRepoRootsInSourceDirs([repo]);
    assert.deepEqual(result, [path.resolve(repo)]);
  });

  it("does not traverse inside a found repository root", () => {
    const root = createTestTempDir("c2a-nested-");
    const monorepo = path.join(root, "monorepo");
    const nested = path.join(monorepo, "packages", "service-a");
    mkdirSync(nested, { recursive: true });
    createGitRepo(monorepo);
    createGitRepo(nested);

    const result = GitWorkingCopy.findRepoRootsInSourceDirs([monorepo]);
    assert.deepEqual(result, [path.resolve(monorepo)]);
  });
});
