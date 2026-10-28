import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBuildTimeDependencyAdjacency,
  canonicalizeCycle,
  dedupeAndSortCanonicalCycles,
  enumerateElementaryCycles,
} from "../../src/generate/module-build-dependency-graph.js";
import { buildCodeInventorySnapshot } from "../../src/code-inventory/code-inventory-snapshot.js";
import { ApplicationModule } from "../../src/code-inventory/entities/application-module.js";
import { ApplicationModuleDependency } from "../../src/code-inventory/entities/application-module-dependency.js";
import { Repository } from "../../src/code-inventory/entities/repository.js";

describe("module-build-dependency-graph", () => {
  it("finds a triangle cycle with closing vertex and canonicalizes duplicates", () => {
    const repo = new Repository({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["maven"],
    }).toCreateIntent();

    const moduleA = new ApplicationModule({
      repositoryId: repo.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "a",
      version: "1",
      name: "a",
      repoPath: "a",
      buildScript: "pom.xml",
      isMultimodule: false,
    }).toCreateIntent();
    const moduleB = new ApplicationModule({
      repositoryId: repo.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "b",
      version: "1",
      name: "b",
      repoPath: "b",
      buildScript: "pom.xml",
      isMultimodule: false,
    }).toCreateIntent();
    const moduleC = new ApplicationModule({
      repositoryId: repo.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "c",
      version: "1",
      name: "c",
      repoPath: "c",
      buildScript: "pom.xml",
      isMultimodule: false,
    }).toCreateIntent();

    const depAb = new ApplicationModuleDependency({
      parentId: moduleA.id,
      groupId: "com.example",
      artifactId: "b",
      version: "1.0",
    }).toCreateIntent();
    const depBc = new ApplicationModuleDependency({
      parentId: moduleB.id,
      groupId: "com.example",
      artifactId: "c",
      version: "1.0",
    }).toCreateIntent();
    const depCa = new ApplicationModuleDependency({
      parentId: moduleC.id,
      groupId: "com.example",
      artifactId: "a",
      version: "1.0",
    }).toCreateIntent();

    const discovery = buildCodeInventorySnapshot({
      scanId: "scan-1",
      sourceRoot: "/workspace",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
      entityArrays: {
        Repository: [repo],
        ApplicationModule: [moduleA, moduleB, moduleC],
        ApplicationModuleDependency: [depAb, depBc, depCa],
      },
    });

    const adjacency = buildBuildTimeDependencyAdjacency(discovery);
    const rawCycles = enumerateElementaryCycles(adjacency);
    assert.ok(rawCycles.length >= 1);
    assert.deepEqual(rawCycles[0][0], rawCycles[0][rawCycles[0].length - 1]);

    const canonical = dedupeAndSortCanonicalCycles(rawCycles);
    assert.equal(canonical.length, 1);
    assert.ok(canonical[0].canonicalCycleKey.includes(moduleA.id));
  });

  it("canonicalizeCycle picks lexicographically minimal shift", () => {
    const cycle = ["mod-b", "mod-c", "mod-a", "mod-b"];
    const canonical = canonicalizeCycle(cycle);
    assert.deepEqual(canonical.canonicalIds[0], "mod-a");
  });
});
