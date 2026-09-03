import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { RunEntityStore } from "../../../../../../src/discovery-model/run-entity-store.js";
import { ModulesAndDependenciesProcessor } from "../../../../../../src/processors/scan/source/assembly/gradle/modules-and-dependencies-processor.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

describe("ModulesAndDependenciesProcessor", () => {
  it("creates modules from gradle build files", () => {
    const root = createTestTempDir("c2a-gradle-proc-");
    writeFileSync(
      path.join(root, "settings.gradle"),
      `rootProject.name = 'demo'
include 'service'`,
    );
    writeFileSync(
      path.join(root, "build.gradle"),
      `group = 'com.gradle'
version = '1.0.0'
implementation 'com.lib:core:1.0.0'`,
    );

    const store = new RunEntityStore({
      sourceDirs: [root],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });
    store.addCreateIntents(
      "scan.scope",
      { groupId: "scan.scope", artifactId: "test" },
      {
        entities: {
          Repository: [
            {
              id: "repo-gradle",
              name: "demo",
              namespace: "/demo",
              localPath: root,
              url: "",
              buildSystems: ["gradle"],
            },
          ],
        },
      },
    );

    const processor = new ModulesAndDependenciesProcessor();
    const output = processor.process(store.snapshot());
    const modules = output.entities?.ApplicationModule ?? [];
    const dependencies = output.entities?.ApplicationModuleDependency ?? [];

    assert.ok(modules.length >= 1);
    assert.equal(modules[0]?.buildSystem, "gradle");
    assert.equal(dependencies[0]?.artifactId, "core");
  });

  it("skips duplicate implementation dependencies in build.gradle", () => {
    const root = createTestTempDir("c2a-gradle-dup-");
    writeFileSync(
      path.join(root, "settings.gradle"),
      `rootProject.name = 'demo'`,
    );
    writeFileSync(
      path.join(root, "build.gradle"),
      `group = 'com.gradle'
version = '1.0.0'
implementation 'com.lib:core:1.0.0'
implementation 'com.lib:core:1.0.0'`,
    );

    const store = new RunEntityStore({
      sourceDirs: [root],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });
    store.addCreateIntents(
      "scan.scope",
      { groupId: "scan.scope", artifactId: "test" },
      {
        entities: {
          Repository: [
            {
              id: "repo-gradle",
              name: "demo",
              namespace: "/demo",
              localPath: root,
              url: "",
              buildSystems: ["gradle"],
            },
          ],
        },
      },
    );

    const processor = new ModulesAndDependenciesProcessor();
    const output = processor.process(store.snapshot());
    const dependencies = output.entities?.ApplicationModuleDependency ?? [];

    assert.equal(dependencies.length, 1);
    assert.equal(dependencies[0]?.artifactId, "core");
    store.addCreateIntents("scan.source", processor.id, output);
  });

  it("inherits javaVersion from root when child build file has no sourceCompatibility", () => {
    const root = createTestTempDir("c2a-gradle-inherit-");
    writeFileSync(
      path.join(root, "settings.gradle"),
      `rootProject.name = 'demo'
include 'service'`,
    );
    writeFileSync(
      path.join(root, "build.gradle"),
      `group = 'com.gradle'
version = '1.0.0'
java {
  sourceCompatibility = JavaVersion.VERSION_17
}`,
    );
    mkdirSync(path.join(root, "service"), { recursive: true });
    writeFileSync(
      path.join(root, "service", "build.gradle"),
      `group = 'com.gradle'
version = '1.0.0'`,
    );

    const store = new RunEntityStore({
      sourceDirs: [root],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });
    store.addCreateIntents(
      "scan.scope",
      { groupId: "scan.scope", artifactId: "test" },
      {
        entities: {
          Repository: [
            {
              id: "repo-gradle",
              name: "demo",
              namespace: "/demo",
              localPath: root,
              url: "",
              buildSystems: ["gradle"],
            },
          ],
        },
      },
    );

    const processor = new ModulesAndDependenciesProcessor();
    const output = processor.process(store.snapshot());
    const modules = output.entities?.ApplicationModule ?? [];

    const service = modules.find((module) => module.artifactId === "service");
    assert.equal(service?.javaVersion, "17");
    assert.ok(service?.parentId);
  });

  it("resolves java and kotlin versions from gradle.properties", () => {
    const root = createTestTempDir("c2a-gradle-props-proc-");
    writeFileSync(
      path.join(root, "settings.gradle.kts"),
      `rootProject.name = "tracking-devices-crud"
pluginManagement {
    plugins {
        kotlin("jvm") version versionKotlin
    }
}`,
    );
    writeFileSync(
      path.join(root, "gradle.properties"),
      `versionJava=1.8
versionKotlin=1.4.21`,
    );
    writeFileSync(
      path.join(root, "build.gradle.kts"),
      `group = "online.oboz.tracking"
version = "abc123"
val compileKotlin: KotlinCompile by tasks
compileKotlin.kotlinOptions {
    jvmTarget = versionJava
}`,
    );

    const store = new RunEntityStore({
      sourceDirs: [root],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });
    store.addCreateIntents(
      "scan.scope",
      { groupId: "scan.scope", artifactId: "test" },
      {
        entities: {
          Repository: [
            {
              id: "repo-gradle",
              name: "tracking-devices-crud",
              namespace: "/tracking/devices-crud",
              localPath: root,
              url: "",
              buildSystems: ["gradle"],
            },
          ],
        },
      },
    );

    const processor = new ModulesAndDependenciesProcessor();
    const output = processor.process(store.snapshot());
    const modules = output.entities?.ApplicationModule ?? [];
    const rootModule = modules.find((module) => module.artifactId === "tracking-devices-crud");

    assert.equal(rootModule?.kotlinJvmTarget, "1.8");
    assert.equal(rootModule?.javaVersion, "1.8");
    assert.equal(rootModule?.kotlinCompilerVersion, "1.4.21");
  });

  it("emits api dependencies and skips testImplementation", () => {
    const root = createTestTempDir("c2a-gradle-proc-configs-");
    writeFileSync(path.join(root, "settings.gradle"), `rootProject.name = 'demo'`);
    writeFileSync(
      path.join(root, "build.gradle"),
      `group = 'com.gradle'
version = '1.0.0'
api 'com.api:api-lib:1.0.0'
testImplementation 'com.test:test-lib:2.0.0'`,
    );

    const store = new RunEntityStore({
      sourceDirs: [root],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });
    store.addCreateIntents(
      "scan.scope",
      { groupId: "scan.scope", artifactId: "test" },
      {
        entities: {
          Repository: [
            {
              id: "repo-gradle",
              name: "demo",
              namespace: "/demo",
              localPath: root,
              url: "",
              buildSystems: ["gradle"],
            },
          ],
        },
      },
    );

    const processor = new ModulesAndDependenciesProcessor();
    const output = processor.process(store.snapshot());
    const dependencies = output.entities?.ApplicationModuleDependency ?? [];

    assert.equal(dependencies.length, 1);
    assert.equal(dependencies[0]?.artifactId, "api-lib");
  });
});
