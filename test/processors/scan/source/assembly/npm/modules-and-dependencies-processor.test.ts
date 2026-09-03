import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { RunEntityStore } from "../../../../../../src/discovery-model/run-entity-store.js";
import { ModulesAndDependenciesProcessor } from "../../../../../../src/processors/scan/source/assembly/npm/modules-and-dependencies-processor.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

describe("ModulesAndDependenciesProcessor", () => {
  it("creates modules from package.json", () => {
    const root = createTestTempDir("c2a-npm-proc-");
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "demo-app",
        version: "1.0.0",
        dependencies: {
          axios: "1.6.0",
        },
      }),
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
              id: "repo-npm",
              name: "demo-app",
              namespace: "/demo-app",
              localPath: root,
              url: "",
              buildSystems: ["npm"],
            },
          ],
        },
      },
    );

    const processor = new ModulesAndDependenciesProcessor();
    const output = processor.process(store.snapshot());
    const modules = output.entities?.ApplicationModule ?? [];
    const dependencies = output.entities?.ApplicationModuleDependency ?? [];

    assert.equal(modules.length, 1);
    assert.equal(modules[0]?.artifactId, "demo-app");
    assert.equal(modules[0]?.buildSystem, "npm");
    assert.equal(dependencies.length, 1);
    assert.equal(dependencies[0]?.artifactId, "axios");
  });

  it("inherits typescriptVersion from workspace root to child package", () => {
    const root = createTestTempDir("c2a-npm-ws-");
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "demo-workspace",
        version: "1.0.0",
        workspaces: ["packages/*"],
        devDependencies: {
          typescript: "^5.4.0",
        },
      }),
    );
    mkdirSync(path.join(root, "packages", "child"), { recursive: true });
    writeFileSync(path.join(root, "packages", "child", "package.json"), JSON.stringify({
      name: "@demo/child",
      version: "1.0.0",
    }));

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
              id: "repo-npm",
              name: "demo-workspace",
              namespace: "/demo-workspace",
              localPath: root,
              url: "",
              buildSystems: ["npm"],
            },
          ],
        },
      },
    );

    const processor = new ModulesAndDependenciesProcessor();
    const output = processor.process(store.snapshot());
    const modules = output.entities?.ApplicationModule ?? [];

    const child = modules.find((module) => module.artifactId === "child");
    assert.equal(child?.typescriptVersion, "^5.4.0");
    assert.ok(child?.parentId);
  });
});
