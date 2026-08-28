import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { RunEntityStore } from "../../../src/discovery-model/run-entity-store.js";
import { GradleModulesAndDependenciesProcessor } from "../../../src/processors/scan-app/gradle-modules-and-dependencies-processor.js";
import { createTestTempDir } from "../../test-temp-dir.js";

describe("GradleModulesAndDependenciesProcessor", () => {
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
      "scan-scope",
      { groupId: "scan-scope", artifactId: "test" },
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

    const processor = new GradleModulesAndDependenciesProcessor();
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
      "scan-scope",
      { groupId: "scan-scope", artifactId: "test" },
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

    const processor = new GradleModulesAndDependenciesProcessor();
    const output = processor.process(store.snapshot());
    const dependencies = output.entities?.ApplicationModuleDependency ?? [];

    assert.equal(dependencies.length, 1);
    assert.equal(dependencies[0]?.artifactId, "core");
    store.addCreateIntents("scan-app", processor.id, output);
  });
});
