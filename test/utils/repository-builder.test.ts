import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { RepositoryBuilder } from "../../src/utils/repository-builder.js";
import { createTestTempDir } from "../test-temp-dir.js";

describe("RepositoryBuilder", () => {
  it("leaves namespace empty on scan.scope", () => {
    const workspaceRoot = createTestTempDir("c2a-builder-ns-");
    const workspaceA = path.join(workspaceRoot, "a");
    const workspaceB = path.join(workspaceRoot, "b");
    const repo = path.join(workspaceA, "my-app");
    mkdirSync(repo, { recursive: true });

    const repository = RepositoryBuilder.buildFromRoot(
      [workspaceA, workspaceB],
      repo,
      "",
    );

    assert.equal(repository.namespace, "");
  });

  it("detects maven, gradle, and npm build systems in repository root", () => {
    const root = createTestTempDir("c2a-builder-build-");
    writeFileSync(path.join(root, "pom.xml"), "<project/>", "utf8");
    writeFileSync(path.join(root, "build.gradle.kts"), "plugins {}", "utf8");
    writeFileSync(path.join(root, "package.json"), "{}", "utf8");
    mkdirSync(path.join(root, "src"));

    const repository = RepositoryBuilder.buildFromRoot([root], root, "");

    assert.deepEqual(repository.buildSystems, ["maven", "gradle", "npm"]);
  });

  it("does not detect build files in nested directories", () => {
    const root = createTestTempDir("c2a-builder-nested-");
    const nested = path.join(root, "module");
    mkdirSync(nested, { recursive: true });
    writeFileSync(path.join(nested, "pom.xml"), "<project/>", "utf8");

    const repository = RepositoryBuilder.buildFromRoot([root], root, "");

    assert.deepEqual(repository.buildSystems, []);
  });
});
