import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  parseGradleProductionJavaSourceRoots,
  resolveMavenProductionJavaSourceRoot,
} from "../../src/parsers/gradle-source-roots.js";
import { createTestTempDir } from "../test-temp-dir.js";

describe("gradle-source-roots", () => {
  it("falls back to src/main/java for gradle modules", () => {
    const root = createTestTempDir("c2a-gradle-roots-");
    const sourceRoot = path.join(root, "src", "main", "java");
    mkdirSync(sourceRoot, { recursive: true });
    writeFileSync(path.join(root, "build.gradle"), "plugins { id 'java' }");

    const roots = parseGradleProductionJavaSourceRoots(root, ".", "build.gradle");

    assert.deepEqual(roots, [sourceRoot]);
  });

  it("excludes test source directories from custom gradle srcDirs", () => {
    const root = createTestTempDir("c2a-gradle-roots-custom-");
    const mainRoot = path.join(root, "src", "main", "java");
    const testRoot = path.join(root, "src", "test", "java");
    mkdirSync(mainRoot, { recursive: true });
    mkdirSync(testRoot, { recursive: true });
    writeFileSync(
      path.join(root, "build.gradle"),
      `sourceSets {
  main {
    java {
      srcDirs 'src/main/java', 'src/test/java'
    }
  }
}`,
    );

    const roots = parseGradleProductionJavaSourceRoots(root, ".", "build.gradle");

    assert.deepEqual(roots, [mainRoot]);
  });

  it("resolves maven production source root", () => {
    const root = createTestTempDir("c2a-maven-roots-");
    const sourceRoot = path.join(root, "src", "main", "java");
    mkdirSync(sourceRoot, { recursive: true });

    assert.equal(resolveMavenProductionJavaSourceRoot(root, "."), sourceRoot);
  });
});
