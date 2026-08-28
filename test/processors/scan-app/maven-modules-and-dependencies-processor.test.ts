import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { RunEntityStore } from "../../../src/discovery-model/run-entity-store.js";
import { MavenModulesAndDependenciesProcessor } from "../../../src/processors/scan-app/maven-modules-and-dependencies-processor.js";
import { createEntityId } from "../../../src/utils/discovery-model-entities.js";
import { createTestTempDir } from "../../test-temp-dir.js";

describe("MavenModulesAndDependenciesProcessor", () => {
  it("creates ApplicationModule and ApplicationModuleDependency from pom.xml", () => {
    const root = createTestTempDir("c2a-maven-proc-");
    writeFileSync(
      path.join(root, "pom.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>app</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>com.dep</groupId>
      <artifactId>lib</artifactId>
      <version>2.0.0</version>
    </dependency>
  </dependencies>
</project>`,
    );

    const repositoryId = createEntityId(["", root]);
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
              id: repositoryId,
              name: "app",
              namespace: "/app",
              localPath: root,
              url: "",
              buildSystems: ["maven"],
            },
          ],
        },
      },
    );

    const processor = new MavenModulesAndDependenciesProcessor();
    const output = processor.process(store.snapshot());
    const modules = output.entities?.ApplicationModule ?? [];
    const dependencies = output.entities?.ApplicationModuleDependency ?? [];

    assert.equal(modules.length, 1);
    assert.equal(modules[0]?.artifactId, "app");
    assert.equal(modules[0]?.buildSystem, "maven");
    assert.equal(dependencies.length, 1);
    assert.equal(dependencies[0]?.artifactId, "lib");
    assert.equal(dependencies[0]?.parentId, modules[0]?.id);
  });

  it("skips repositories without maven build system", () => {
    const root = createTestTempDir("c2a-maven-skip-");
    mkdirSync(root, { recursive: true });

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
              id: "repo-1",
              name: "app",
              namespace: "/app",
              localPath: root,
              url: "",
              buildSystems: ["npm"],
            },
          ],
        },
      },
    );

    const processor = new MavenModulesAndDependenciesProcessor();
    const output = processor.process(store.snapshot());
    assert.equal(output.entities?.ApplicationModule?.length ?? 0, 0);
  });
});
