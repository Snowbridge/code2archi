import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  mergeGradleModuleVersions,
  mergeMavenModuleVersions,
  parseNpmBuildVersions,
  readGradleWrapperVersion,
  UNKNOWN_VERSION,
} from "../../src/parsers/build-tool-versions.js";
import { parseMavenRepository } from "../../src/parsers/maven-pom-parser.js";
import { createTestTempDir } from "../test-temp-dir.js";

describe("build-tool-versions", () => {
  it("reads gradle wrapper version from distributionUrl", () => {
    const root = createTestTempDir("c2a-gradle-wrapper-");
    mkdirSync(path.join(root, "gradle", "wrapper"), { recursive: true });
    writeFileSync(
      path.join(root, "gradle", "wrapper", "gradle-wrapper.properties"),
      "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.5-bin.zip\n",
    );

    assert.equal(readGradleWrapperVersion(root), "8.5");
  });

  it("extracts java and kotlin versions from gradle build file", () => {
    const content = `
plugins {
  id("org.jetbrains.kotlin.jvm") version "1.9.22"
}
java {
  sourceCompatibility = JavaVersion.VERSION_17
}
tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
  kotlinOptions.jvmTarget = "17"
}
`;
    const versions = mergeGradleModuleVersions("/tmp", content);
    assert.equal(versions.buildToolVersion, UNKNOWN_VERSION);
    assert.equal(versions.javaVersion, "17");
    assert.equal(versions.kotlinJvmTarget, "17");
    assert.equal(versions.kotlinCompilerVersion, "1.9.22");
  });

  it("extracts java version from maven effective properties", () => {
    const root = createTestTempDir("c2a-maven-java-");
    writeFileSync(
      path.join(root, "pom.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>app</artifactId>
  <version>1.0.0</version>
  <properties>
    <java.version>11</java.version>
  </properties>
</project>`,
    );

    const modules = parseMavenRepository(root);
    assert.equal(modules[0]?.javaVersion, "11");
    assert.equal(modules[0]?.buildToolVersion, UNKNOWN_VERSION);
  });

  it("parses npm packageManager and engines.node", () => {
    const versions = parseNpmBuildVersions({
      packageManager: "npm@10.2.0",
      engines: { node: ">=18.0.0" },
    });
    assert.equal(versions.buildToolVersion, "10.2.0");
    assert.equal(versions.nodeVersion, ">=18.0.0");
    assert.equal(versions.javaVersion, UNKNOWN_VERSION);
  });

  it("parses typescript and tsx from devDependencies", () => {
    const versions = parseNpmBuildVersions({
      devDependencies: {
        typescript: "^5.4.0",
        tsx: "4.7.0",
      },
    });
    assert.equal(versions.typescriptVersion, "^5.4.0");
    assert.equal(versions.tsxVersion, "4.7.0");
  });

  it("falls back to dependencies for typescript and tsx", () => {
    const versions = parseNpmBuildVersions({
      dependencies: {
        typescript: "5.3.3",
      },
    });
    assert.equal(versions.typescriptVersion, "5.3.3");
    assert.equal(versions.tsxVersion, UNKNOWN_VERSION);
  });
});
