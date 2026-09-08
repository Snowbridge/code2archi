import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterSerializableDiscoverySnapshotToRepository,
  serializeDiscoverySnapshot,
} from "../../../src/platform/parallelism/snapshot-serialization.js";
import { buildScanRepositoryBatchTasks, buildScanSourceTasks } from "../../../src/platform/parallelism/task-planner.js";
import { buildCodeInventorySnapshot } from "../../../src/code-inventory/code-inventory-snapshot.js";

describe("filterSerializableDiscoverySnapshotToRepository", () => {
  const snapshot = buildCodeInventorySnapshot({
    scanId: "scan-1",
    sourceRoot: "/src",
    sourceDirs: ["/src"],
    repositoryCommonRoot: "/src",
    runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    entityArrays: {
      Repository: [
        {
          id: "repo-a",
          name: "a",
          namespace: "/a",
          localPath: "/src/a",
          url: "",
          buildSystems: ["maven"],
        },
        {
          id: "repo-b",
          name: "b",
          namespace: "/b",
          localPath: "/src/b",
          url: "",
          buildSystems: ["maven"],
        },
      ],
      ApplicationModule: [
        {
          id: "mod-a",
          repositoryId: "repo-a",
          name: "mod-a",
          namespace: "/a/mod",
          buildSystem: "maven",
          coordinates: "a:mod:1",
        },
        {
          id: "mod-b",
          repositoryId: "repo-b",
          name: "mod-b",
          namespace: "/b/mod",
          buildSystem: "maven",
          coordinates: "b:mod:1",
        },
      ],
      ApplicationModuleDependency: [
        {
          id: "dep-a",
          parentId: "mod-a",
          groupId: "g",
          artifactId: "lib",
          version: "1",
        },
      ],
    },
  });

  const serialized = serializeDiscoverySnapshot(snapshot);

  it("keeps only target repository in assembly scope", () => {
    const filtered = filterSerializableDiscoverySnapshotToRepository(serialized, "repo-a", "assembly");

    assert.deepEqual(filtered.entities.Repository?.map((record) => record.id), ["repo-a"]);
    assert.equal(filtered.entities.ApplicationModule, undefined);
    assert.deepEqual(filtered.links, {});
  });

  it("keeps target repository and its modules in module-source scope", () => {
    const filtered = filterSerializableDiscoverySnapshotToRepository(
      serialized,
      "repo-a",
      "module-source",
    );

    assert.deepEqual(filtered.entities.Repository?.map((record) => record.id), ["repo-a"]);
    assert.deepEqual(filtered.entities.ApplicationModule?.map((record) => record.id), ["mod-a"]);
    assert.equal(filtered.entities.ApplicationModuleDependency, undefined);
    assert.deepEqual(filtered.links, {});
  });
});

describe("buildScanSourceTasks", () => {
  it("builds processor x repository tasks for all processors in one call", () => {
    const snapshot = buildCodeInventorySnapshot({
      scanId: "scan-1",
      sourceRoot: "/src",
      sourceDirs: ["/src"],
      repositoryCommonRoot: "/src",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
      entityArrays: {
        Repository: [
          {
            id: "repo-a",
            name: "a",
            namespace: "/a",
            localPath: "/src/a",
            url: "",
            buildSystems: ["maven"],
          },
          {
            id: "repo-b",
            name: "b",
            namespace: "/b",
            localPath: "/src/b",
            url: "",
            buildSystems: ["maven"],
          },
        ],
      },
    });

    const processors = [
      { id: { groupId: "scan.extract.assembly.maven", artifactId: "modules-and-dependencies" } },
      { id: { groupId: "scan.extract.assembly.gradle", artifactId: "modules-and-dependencies" } },
    ];

    const tasks = buildScanSourceTasks(processors, snapshot, "2");

    assert.equal(tasks.length, 4);
    assert.ok(tasks.every((task) => task.input.repositoryId !== undefined));
    assert.ok(tasks.every((task) => task.input.snapshot === undefined));
    assert.ok(
      tasks.some((task) =>
        task.taskId === "scan.extract.assembly.maven/modules-and-dependencies:repo-a",
      ),
    );
    assert.ok(
      tasks.some((task) =>
        task.taskId === "scan.extract.assembly.gradle/modules-and-dependencies:repo-b",
      ),
    );
  });
});

describe("buildScanRepositoryBatchTasks", () => {
  it("builds one task per repository with all processors in order", () => {
    const snapshot = buildCodeInventorySnapshot({
      scanId: "scan-1",
      sourceRoot: "/src",
      sourceDirs: ["/src"],
      repositoryCommonRoot: "/src",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
      entityArrays: {
        Repository: [
          {
            id: "repo-a",
            name: "a",
            namespace: "/a",
            localPath: "/src/a",
            url: "",
            buildSystems: ["maven"],
          },
          {
            id: "repo-b",
            name: "b",
            namespace: "/b",
            localPath: "/src/b",
            url: "",
            buildSystems: ["maven"],
          },
        ],
      },
    });

    const processors = [
      { id: { groupId: "scan.extract.assembly.maven", artifactId: "modules-and-dependencies" } },
      { id: { groupId: "scan.extract.assembly.gradle", artifactId: "modules-and-dependencies" } },
    ];

    const tasks = buildScanRepositoryBatchTasks(
      processors,
      snapshot,
      "2",
      "assembly",
      false,
    );

    assert.equal(tasks.length, 2);
    assert.deepEqual(tasks[0]?.input.processors, processors.map((processor) => processor.id));
    assert.equal(tasks[0]?.taskId, "scan.extract:assembly:repo-a");
    assert.equal(tasks[1]?.taskId, "scan.extract:assembly:repo-b");
    assert.equal(tasks[0]?.input.repositoryId, "repo-a");
    assert.equal(tasks[0]?.input.continueOnError, false);
  });

  it("uses module-source in task id for module-source phase scope", () => {
    const snapshot = buildCodeInventorySnapshot({
      scanId: "scan-1",
      sourceRoot: "/src",
      sourceDirs: ["/src"],
      repositoryCommonRoot: "/src",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
      entityArrays: {
        Repository: [
          {
            id: "repo-a",
            name: "a",
            namespace: "/a",
            localPath: "/src/a",
            url: "",
            buildSystems: ["gradle"],
          },
        ],
      },
    });

    const processors = [
      { id: { groupId: "scan.extract.rest.controllers", artifactId: "spring-webmvc" } },
    ];

    const tasks = buildScanRepositoryBatchTasks(
      processors,
      snapshot,
      "2",
      "module-source",
      false,
    );

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.taskId, "scan.extract:module-source:repo-a");
  });
});
