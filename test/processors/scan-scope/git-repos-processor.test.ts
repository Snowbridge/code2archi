import assert from "node:assert/strict";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { GitReposProcessor } from "../../../src/processors/scan-scope/git-repos-processor.js";
import { createEntityId } from "../../../src/utils/discovery-model-entities.js";
import { createTestTempDir } from "../../test-temp-dir.js";

function createGitRepo(dir: string): void {
  mkdirSync(path.join(dir, ".git"), { recursive: true });
}

function posixNamespace(from: string, to: string): string {
  const relative = path.relative(path.resolve(from), path.resolve(to));
  return `/${relative.split(path.sep).join("/")}`;
}

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

  it("builds Repository with empty url for non-git worktrees", () => {
    const root = createTestTempDir("c2a-repo-entity-");
    const repo = path.join(root, "my-app");
    mkdirSync(repo, { recursive: true });
    createGitRepo(repo);
    writeFileSync(path.join(repo, "pom.xml"), "<project/>", "utf8");

    const processor = new GitReposProcessor();
    const [repository] = processor.process([repo]);

    assert.equal(repository?.name, "my-app");
    assert.equal(repository?.localPath, path.resolve(repo));
    assert.equal(repository?.url, "");
    assert.deepEqual(repository?.buildSystems, ["maven"]);
    assert.equal(repository?.id, createEntityId(["", path.resolve(repo)]));
  });

  it("strips common path prefix from sourceDirs into namespace", () => {
    const workspaceRoot = createTestTempDir("c2a-ns-");
    const workspaceA = path.join(workspaceRoot, "a");
    const workspaceB = path.join(workspaceRoot, "b");
    const repo = path.join(workspaceA, "my-app");
    mkdirSync(workspaceB, { recursive: true });
    mkdirSync(repo, { recursive: true });
    createGitRepo(repo);

    const processor = new GitReposProcessor();
    const [repository] = processor.process([workspaceA, workspaceB]);

    assert.equal(
      repository?.namespace,
      posixNamespace(workspaceRoot, path.resolve(repo)),
    );
  });

  it("uses full localPath as namespace when sourceDirs share only filesystem root", () => {
    const fsRoot = path.parse(createTestTempDir("c2a-ns-root-")).root;
    const foo = path.join(fsRoot, "c2a-ns-foo", "foo");
    const bar = path.join(fsRoot, "c2a-ns-bar", "bar");
    const repo = path.join(foo, "repo");
    mkdirSync(bar, { recursive: true });
    mkdirSync(repo, { recursive: true });
    createGitRepo(repo);

    const processor = new GitReposProcessor();
    const [repository] = processor.process([foo, bar]);

    assert.equal(repository?.namespace, path.resolve(repo));
  });

  it("strips a single source directory prefix into namespace", () => {
    const sourceDir = createTestTempDir("c2a-ns-single-");
    const repo = path.join(sourceDir, "my-app");
    mkdirSync(repo, { recursive: true });
    createGitRepo(repo);

    const processor = new GitReposProcessor();
    const [repository] = processor.process([sourceDir]);

    assert.equal(repository?.namespace, posixNamespace(sourceDir, path.resolve(repo)));
  });

  it("detects maven, gradle, and npm build systems in repository root", () => {
    const root = createTestTempDir("c2a-build-");
    createGitRepo(root);
    writeFileSync(path.join(root, "pom.xml"), "<project/>", "utf8");
    writeFileSync(path.join(root, "build.gradle.kts"), "plugins {}", "utf8");
    writeFileSync(path.join(root, "package.json"), "{}", "utf8");
    mkdirSync(path.join(root, "src"));

    const processor = new GitReposProcessor();
    const [repository] = processor.process([root]);

    assert.deepEqual(repository?.buildSystems, ["maven", "gradle", "npm"]);
  });

  it("returns empty buildSystems when no build files exist", () => {
    const root = createTestTempDir("c2a-build-empty-");
    createGitRepo(root);
    mkdirSync(path.join(root, "src"));

    const processor = new GitReposProcessor();
    const [repository] = processor.process([root]);

    assert.deepEqual(repository?.buildSystems, []);
  });

  it("does not detect build files in nested directories", () => {
    const root = createTestTempDir("c2a-build-nested-");
    createGitRepo(root);
    const nested = path.join(root, "module");
    mkdirSync(nested, { recursive: true });
    writeFileSync(path.join(nested, "pom.xml"), "<project/>", "utf8");

    const processor = new GitReposProcessor();
    const [repository] = processor.process([root]);

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

    const processor = new GitReposProcessor();
    const result = processor.process([linkParent]);

    assert.deepEqual(result, []);
  });
});
