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

  it("parses api, implementation, and legacy compile dependencies", () => {
    const root = createTestTempDir("c2a-gradle-configs-");
    writeFileSync(path.join(root, "settings.gradle"), `rootProject.name = 'configs'`);
    writeFileSync(
      path.join(root, "build.gradle"),
      `group = 'com.example'
version = '1.0.0'
api 'com.api:api-lib:1.0.0'
implementation 'com.impl:impl-lib:2.0.0'
compile 'com.legacy:legacy-lib:3.0.0'
testImplementation 'com.test:test-lib:4.0.0'
runtimeOnly 'com.runtime:runtime-lib:5.0.0'
runtime 'com.runtime:runtime-legacy:6.0.0'`,
    );

    const modules = parseGradleRepository(root);
    const artifactIds = modules[0]?.dependencies.map((dependency) => dependency.artifactId);

    assert.deepEqual(artifactIds, ["api-lib", "impl-lib", "legacy-lib"]);
  });

  it("uses repository folder name when rootProject.name is missing in settings", () => {
    const root = createTestTempDir("c2a-gradle-folder-name-");
    writeFileSync(path.join(root, "settings.gradle"), `include 'service-a'`);
    writeFileSync(
      path.join(root, "build.gradle"),
      `group = 'com.example'
version = '1.0.0'`,
    );

    const modules = parseGradleRepository(root);
    const rootModule = modules.find((module) => module.repoPath === ".");

    assert.equal(rootModule?.coordinates.artifactId, path.basename(root));
  });

  it("does not mark single-module project as multimodule when processResources uses include globs", () => {
    const root = createTestTempDir("c2a-gradle-process-resources-");
    writeFileSync(
      path.join(root, "build.gradle"),
      `group = 'online.oboz.seal.auth'
version = '0.0.1'

processResources {
    from(sourceSets["main"].resources.srcDirs) {
        include("**/bootstrap.yml","**/application.yml","**/banner.txt")
    }
}`,
    );

    const modules = parseGradleRepository(root);

    assert.equal(modules.length, 1);
    assert.equal(modules[0]?.isMultimodule, false);
    assert.deepEqual(modules[0]?.childModulePaths, []);
  });
});
