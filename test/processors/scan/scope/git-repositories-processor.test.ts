import assert from "node:assert/strict";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { GitRepositoriesProcessor } from "../../../../src/processors/scan/scope/git-repositories-processor.js";
import { Repository } from "../../../../src/discovery-model/entities/repository.js";
import { createTestTempDir } from "../../../test-temp-dir.js";

function createGitRepo(dir: string): void {
  mkdirSync(path.join(dir, ".git"), { recursive: true });
}

describe("GitRepositoriesProcessor", () => {
  it("exposes scan.scope coordinates", () => {
    const processor = new GitRepositoriesProcessor();

    assert.deepEqual(processor.id, {
      groupId: "scan.scope",
      artifactId: "git-repositories",
    });
    assert.equal(processor.version, "0.2.0");
    assert.equal(processor.executionPolicy, "ALWAYS");
  });

  it("returns Repository entities", () => {
    const root = createTestTempDir("c2a-processor-");
    const repo = path.join(root, "service");
    mkdirSync(repo, { recursive: true });
    createGitRepo(repo);

    const processor = new GitRepositoriesProcessor();
    const result = processor.process({ sourceDirs: [repo] });

    assert.equal(result.length, 1);
    assert.equal(result[0]?.name, "service");
    assert.equal(result[0]?.localPath, path.resolve(repo));
  });

  it("builds Repository with empty url for non-git worktrees", () => {
    const root = createTestTempDir("c2a-repo-entity-");
    const repo = path.join(root, "my-app");
    mkdirSync(repo, { recursive: true });
    createGitRepo(repo);
    writeFileSync(path.join(repo, "pom.xml"), "<project/>", "utf8");

    const processor = new GitRepositoriesProcessor();
    const [repository] = processor.process({ sourceDirs: [repo] });

    assert.equal(repository?.name, "my-app");
    assert.equal(repository?.localPath, path.resolve(repo));
    assert.equal(repository?.url, "");
    assert.deepEqual(repository?.buildSystems, ["maven"]);
    assert.equal(
      repository?.id,
      new Repository({
        url: "",
        localPath: path.resolve(repo),
        name: "my-app",
        namespace: repository?.namespace ?? "",
        buildSystems: ["maven"],
      }).id,
    );
  });

  it("leaves namespace empty on scan.scope", () => {
    const workspaceRoot = createTestTempDir("c2a-ns-");
    const workspaceA = path.join(workspaceRoot, "a");
    const workspaceB = path.join(workspaceRoot, "b");
    const repo = path.join(workspaceA, "my-app");
    mkdirSync(workspaceB, { recursive: true });
    mkdirSync(repo, { recursive: true });
    createGitRepo(repo);

    const processor = new GitRepositoriesProcessor();
    const [repository] = processor.process({ sourceDirs: [workspaceA, workspaceB] });

    assert.equal(repository?.namespace, "");
  });

  it("detects maven, gradle, and npm build systems in repository root", () => {
    const root = createTestTempDir("c2a-build-");
    createGitRepo(root);
    writeFileSync(path.join(root, "pom.xml"), "<project/>", "utf8");
    writeFileSync(path.join(root, "build.gradle.kts"), "plugins {}", "utf8");
    writeFileSync(path.join(root, "package.json"), "{}", "utf8");
    mkdirSync(path.join(root, "src"));

    const processor = new GitRepositoriesProcessor();
    const [repository] = processor.process({ sourceDirs: [root] });

    assert.deepEqual(repository?.buildSystems, ["maven", "gradle", "npm"]);
  });

  it("returns empty buildSystems when no build files exist", () => {
    const root = createTestTempDir("c2a-build-empty-");
    createGitRepo(root);
    mkdirSync(path.join(root, "src"));

    const processor = new GitRepositoriesProcessor();
    const [repository] = processor.process({ sourceDirs: [root] });

    assert.deepEqual(repository?.buildSystems, []);
  });

  it("does not detect build files in nested directories", () => {
    const root = createTestTempDir("c2a-build-nested-");
    createGitRepo(root);
    const nested = path.join(root, "module");
    mkdirSync(nested, { recursive: true });
    writeFileSync(path.join(nested, "pom.xml"), "<project/>", "utf8");

    const processor = new GitRepositoriesProcessor();
    const [repository] = processor.process({ sourceDirs: [root] });

    assert.deepEqual(repository?.buildSystems, []);
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

    const processor = new GitRepositoriesProcessor();
    const result = processor.process({ sourceDirs: [linkParent] });

    assert.deepEqual(result, []);
  });

  it("ticks progress once per discovered repository", () => {
    const root = createTestTempDir("c2a-progress-");
    const first = path.join(root, "first");
    const second = path.join(root, "second");
    mkdirSync(first, { recursive: true });
    mkdirSync(second, { recursive: true });
    createGitRepo(first);
    createGitRepo(second);

    let tickCount = 0;
    let lastTotal = 0;
    const progress = {
      tick(count = 1): void {
        tickCount += count;
      },
      setTotal(total: number): void {
        lastTotal = total;
      },
    };

    const processor = new GitRepositoriesProcessor();
    const result = processor.process({ sourceDirs: [root], progress });

    assert.equal(result.length, 2);
    assert.equal(tickCount, 2);
    assert.equal(lastTotal, 2);
  });
});
