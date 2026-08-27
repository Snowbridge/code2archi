import assert from "node:assert/strict";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildRepositoriesFromSourceDirs } from "../../../src/processors/scan-scope/build-repositories-from-source-dirs.js";
import { findGitRepoRootsInSourceDirs } from "../../../src/processors/scan-scope/find-git-repo-roots.js";
import { GitReposProcessor } from "../../../src/processors/scan-scope/git-repos-processor.js";
import { createRepositoryId } from "../../../src/processors/scan-scope/create-repository-id.js";
import { createTestTempDir } from "../../test-temp-dir.js";

function createGitRepo(dir: string): void {
  mkdirSync(path.join(dir, ".git"), { recursive: true });
}

describe("findGitRepoRootsInSourceDirs", () => {
  it("finds a single repository root", () => {
    const root = createTestTempDir("c2a-git-");
    const repo = path.join(root, "my-app");
    mkdirSync(repo, { recursive: true });
    createGitRepo(repo);

    const result = findGitRepoRootsInSourceDirs([repo]);
    assert.deepEqual(result, [path.resolve(repo)]);
  });

  it("does not traverse inside a found repository root", () => {
    const root = createTestTempDir("c2a-nested-");
    const monorepo = path.join(root, "monorepo");
    const nested = path.join(monorepo, "packages", "service-a");
    mkdirSync(nested, { recursive: true });
    createGitRepo(monorepo);
    createGitRepo(nested);

    const result = findGitRepoRootsInSourceDirs([monorepo]);
    assert.deepEqual(result, [path.resolve(monorepo)]);
  });
});

describe("buildRepositoriesFromSourceDirs", () => {
  it("builds Repository entities with empty url for non-git worktrees", () => {
    const root = createTestTempDir("c2a-repo-entity-");
    const repo = path.join(root, "my-app");
    mkdirSync(repo, { recursive: true });
    createGitRepo(repo);
    writeFileSync(path.join(repo, "pom.xml"), "<project/>", "utf8");

    const [repository] = buildRepositoriesFromSourceDirs([repo]);

    assert.equal(repository.name, "my-app");
    assert.equal(repository.localPath, path.resolve(repo));
    assert.equal(repository.url, "");
    assert.deepEqual(repository.buildSystems, ["maven"]);
    assert.equal(repository.id, createRepositoryId("", path.resolve(repo)));
  });
});

describe("GitReposProcessor", () => {
  it("exposes scan-scope coordinates", () => {
    const processor = new GitReposProcessor();

    assert.deepEqual(processor.id, {
      groupId: "scan-scope",
      artifactId: "git-repos",
    });
    assert.equal(processor.version, "0.2.0");
  });

  it("returns Repository entities", () => {
    const root = createTestTempDir("c2a-processor-");
    const repo = path.join(root, "service");
    mkdirSync(repo, { recursive: true });
    createGitRepo(repo);

    const processor = new GitReposProcessor();
    const result = processor.process([repo]);

    assert.equal(result.length, 1);
    assert.equal(result[0]?.name, "service");
    assert.equal(result[0]?.localPath, path.resolve(repo));
  });

  it("does not follow directory symlinks during discovery", () => {
    const root = createTestTempDir("c2a-symlink-");
    const realRepo = path.join(root, "real");
    const linkParent = path.join(root, "linked-parent");
    mkdirSync(realRepo, { recursive: true });
    mkdirSync(linkParent, { recursive: true });
    createGitRepo(realRepo);

    const linkTarget = path.join(linkParent, "linked");
    symlinkSync(realRepo, linkTarget, "dir");

    const processor = new GitReposProcessor();
    const result = processor.process([linkParent]);

    assert.deepEqual(result, []);
  });
});
