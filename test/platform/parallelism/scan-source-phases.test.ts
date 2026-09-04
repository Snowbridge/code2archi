import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyScanSourcePhase,
  partitionScanSourceProcessors,
} from "../../../src/platform/parallelism/scan-source-phases.js";
import {
  filterSerializableDiscoverySnapshotToRepository,
  serializeDiscoverySnapshot,
} from "../../../src/platform/parallelism/snapshot-serialization.js";
import { buildScanRepositoryBatchTasks, buildScanSourceTasks } from "../../../src/platform/parallelism/task-planner.js";
import { buildDiscoveryModelSnapshot } from "../../../src/discovery-model/discovery-model-snapshot.js";

describe("scan source phases", () => {
  it("classifies assembly processors by groupId prefix", () => {
    assert.equal(
      classifyScanSourcePhase("scan.source.assembly.maven"),
      "assembly",
    );
    assert.equal(
      classifyScanSourcePhase("scan.source.java.rest"),
      "rest",
    );
  });

  it("partitions processors into assembly and rest groups", () => {
    const processors = [
      { id: { groupId: "scan.source.assembly.maven", artifactId: "modules-and-dependencies" } },
      { id: { groupId: "scan.source.assembly.gradle", artifactId: "modules-and-dependencies" } },
      { id: { groupId: "scan.source.java.rest", artifactId: "client-declarative" } },
    ];

    const { assembly, rest } = partitionScanSourceProcessors(processors);
    assert.equal(assembly.length, 2);
    assert.equal(rest.length, 1);
  });
});

describe("filterSerializableDiscoverySnapshotToRepository", () => {
  const snapshot = buildDiscoveryModelSnapshot({
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
    const filtered = filterSerializableDiscoverySnapshotToRepository(
      serialized,
      "repo-a",
      "assembly",
    );

    assert.deepEqual(filtered.entities.Repository?.map((record) => record.id), ["repo-a"]);
    assert.equal(filtered.entities.ApplicationModule, undefined);
    assert.deepEqual(filtered.links, {});
  });

  it("keeps repository modules and dependencies in rest scope", () => {
    const filtered = filterSerializableDiscoverySnapshotToRepository(
      serialized,
      "repo-a",
      "rest",
    );

    assert.deepEqual(filtered.entities.Repository?.map((record) => record.id), ["repo-a"]);
    assert.deepEqual(filtered.entities.ApplicationModule?.map((record) => record.id), ["mod-a"]);
    assert.deepEqual(filtered.entities.ApplicationModuleDependency?.map((record) => record.id), [
      "dep-a",
    ]);
    assert.equal(filtered.entities.ApplicationModule?.[0]?.repositoryId, "repo-a");
  });
});

describe("buildScanSourceTasks", () => {
  it("builds processor x repository tasks for all processors in one call", () => {
    const snapshot = buildDiscoveryModelSnapshot({
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
      { id: { groupId: "scan.source.assembly.maven", artifactId: "modules-and-dependencies" } },
      { id: { groupId: "scan.source.assembly.gradle", artifactId: "modules-and-dependencies" } },
    ];

    const tasks = buildScanSourceTasks(processors, snapshot, "2");

    assert.equal(tasks.length, 4);
    assert.ok(tasks.every((task) => task.input.repositoryId !== undefined));
    assert.ok(tasks.every((task) => task.input.snapshot === undefined));
    assert.ok(
      tasks.some((task) =>
        task.taskId === "scan.source.assembly.maven/modules-and-dependencies:repo-a",
      ),
    );
    assert.ok(
      tasks.some((task) =>
        task.taskId === "scan.source.assembly.gradle/modules-and-dependencies:repo-b",
      ),
    );
  });
});

describe("buildScanRepositoryBatchTasks", () => {
  it("builds one task per repository with all processors in order", () => {
    const snapshot = buildDiscoveryModelSnapshot({
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
      { id: { groupId: "scan.source.assembly.maven", artifactId: "modules-and-dependencies" } },
      { id: { groupId: "scan.source.assembly.gradle", artifactId: "modules-and-dependencies" } },
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
    assert.equal(tasks[0]?.taskId, "scan.source:assembly:repo-a");
    assert.equal(tasks[1]?.taskId, "scan.source:assembly:repo-b");
    assert.equal(tasks[0]?.input.repositoryId, "repo-a");
    assert.equal(tasks[0]?.input.continueOnError, false);
  });
});
