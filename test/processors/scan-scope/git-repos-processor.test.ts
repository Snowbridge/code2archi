import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { findGitRepoRootsInSourceDirs } from "../../../src/processors/scan-scope/find-git-repo-roots.js";
import { GitReposProcessor } from "../../../src/processors/scan-scope/git-repos-processor.js";

function createGitRepo(dir: string): void {
  mkdirSync(path.join(dir, ".git"), { recursive: true });
}

describe("findGitRepoRootsInSourceDirs", () => {
  it("finds a single repository root", () => {
    const root = mkdtempSync(path.join(tmpdir(), "c2a-git-"));
    const repo = path.join(root, "my-app");
    mkdirSync(repo, { recursive: true });
    createGitRepo(repo);

    const result = findGitRepoRootsInSourceDirs([repo]);
    assert.deepEqual(result, [path.resolve(repo)]);
  });

  it("does not traverse inside a found repository root", () => {
    const root = mkdtempSync(path.join(tmpdir(), "c2a-nested-"));
    const monorepo = path.join(root, "monorepo");
    const nested = path.join(monorepo, "packages", "service-a");
    mkdirSync(nested, { recursive: true });
    createGitRepo(monorepo);
    createGitRepo(nested);

    const result = findGitRepoRootsInSourceDirs([monorepo]);
    assert.deepEqual(result, [path.resolve(monorepo)]);
  });

  it("deduplicates overlapping source directories", () => {
    const root = mkdtempSync(path.join(tmpdir(), "c2a-overlap-"));
    const repo = path.join(root, "repo");
    mkdirSync(repo, { recursive: true });
    createGitRepo(repo);

    const result = findGitRepoRootsInSourceDirs([repo, root]);
    assert.deepEqual(result, [path.resolve(repo)]);
  });

  it("returns empty list when no git repositories are found", () => {
    const root = mkdtempSync(path.join(tmpdir(), "c2a-no-git-"));
    const plain = path.join(root, "plain");
    mkdirSync(plain, { recursive: true });

    const result = findGitRepoRootsInSourceDirs([plain]);
    assert.deepEqual(result, []);
  });

  it("ignores .git file entries", () => {
    const root = mkdtempSync(path.join(tmpdir(), "c2a-git-file-"));
    const repo = path.join(root, "submodule-worktree");
    mkdirSync(repo, { recursive: true });
    writeFileSync(path.join(repo, ".git"), "gitdir: ../.git/modules/foo", "utf8");

    const result = findGitRepoRootsInSourceDirs([repo]);
    assert.deepEqual(result, []);
  });

  it("does not follow directory symlinks", () => {
    const root = mkdtempSync(path.join(tmpdir(), "c2a-symlink-"));
    const realRepo = path.join(root, "real");
    const linkParent = path.join(root, "linked-parent");
    mkdirSync(realRepo, { recursive: true });
    mkdirSync(linkParent, { recursive: true });
    createGitRepo(realRepo);

    const linkTarget = path.join(linkParent, "linked");
    symlinkSync(realRepo, linkTarget, "dir");

    const result = findGitRepoRootsInSourceDirs([linkParent]);
    assert.deepEqual(result, []);
  });
});

describe("GitReposProcessor", () => {
  it("exposes scan-scope coordinates", () => {
    const processor = new GitReposProcessor();

    assert.deepEqual(processor.id, {
      groupId: "scan-scope",
      artifactId: "git-repos",
    });
    assert.equal(processor.version, "0.1.0");
  });
});
