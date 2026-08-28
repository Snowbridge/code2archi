import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { parseGradleRepository } from "../../src/parsers/gradle-build-parser.js";
import { createTestTempDir } from "../test-temp-dir.js";

describe("gradle-build-parser", () => {
  it("parses settings includes and implementation dependencies", () => {
    const root = createTestTempDir("c2a-gradle-");
    writeFileSync(
      path.join(root, "settings.gradle"),
      `rootProject.name = 'demo'
include 'service-a', 'service-b'`,
    );
    writeFileSync(
      path.join(root, "build.gradle"),
      `group = 'com.example'
version = '1.0.0'
implementation 'org.springframework:spring-core:6.1.0'`,
    );
    mkdirSync(path.join(root, "service-a"), { recursive: true });
    writeFileSync(
      path.join(root, "service-a", "build.gradle"),
      `group = 'com.example'
version = '1.0.0'`,
    );

    const modules = parseGradleRepository(root);
    assert.ok(modules.length >= 1);
    const rootModule = modules.find((module) => module.repoPath === ".");
    assert.equal(rootModule?.coordinates.groupId, "com.example");
    assert.equal(rootModule?.isMultimodule, true);
    assert.equal(rootModule?.dependencies[0]?.artifactId, "spring-core");
    assert.ok(modules.some((module) => module.repoPath === "service-a"));
  });

  it("parses kotlin dsl implementation dependency", () => {
    const root = createTestTempDir("c2a-gradle-kts-");
    writeFileSync(path.join(root, "build.gradle.kts"), `group = "com.kts"
version = "2.0.0"
dependencies {
  implementation("com.google.guava:guava:33.0.0-jre")
}`);
    writeFileSync(path.join(root, "settings.gradle.kts"), `rootProject.name = "kts-root"`);

    const modules = parseGradleRepository(root);
    assert.equal(modules[0]?.dependencies[0]?.artifactId, "guava");
  });
});
