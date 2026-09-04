import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDiscoveryModelSnapshot } from "../../../src/discovery-model/discovery-model-snapshot.js";
import { RunEntityStore } from "../../../src/discovery-model/run-entity-store.js";
import {
  collectRepositoryBatchProcessorErrors,
  mergeRepositoryBatchResults,
} from "../../../src/platform/processors/parallel-group-runner.js";
import type { ScanRepositoryBatchTaskResult } from "../../../src/platform/parallelism/task-inputs.js";
import { formatProcessorTaskKey } from "../../../src/platform/parallelism/task-inputs.js";

describe("mergeRepositoryBatchResults", () => {
  it("routes batch outputs to the correct processor in the store", () => {
    const store = new RunEntityStore(
      buildDiscoveryModelSnapshot({
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
          ],
        },
      }),
    );

    const mavenProcessor = {
      groupId: "scan.source.assembly.maven",
      artifactId: "modules-and-dependencies",
    };
    const gradleProcessor = {
      groupId: "scan.source.assembly.gradle",
      artifactId: "modules-and-dependencies",
    };

    const batch: ScanRepositoryBatchTaskResult = {
      outputs: {
        [formatProcessorTaskKey(mavenProcessor)]: {
          entities: {
            ApplicationModule: [
              {
                id: "mod-a",
                repositoryId: "repo-a",
                name: "mod-a",
                namespace: "/a/mod",
                buildSystem: "maven",
                coordinates: "a:mod:1",
              },
            ],
          },
        },
        [formatProcessorTaskKey(gradleProcessor)]: {
          entities: {
            ApplicationModule: [
              {
                id: "mod-b",
                repositoryId: "repo-a",
                name: "mod-b",
                namespace: "/a/mod-b",
                buildSystem: "gradle",
                coordinates: "a:mod-b:1",
              },
            ],
          },
        },
      },
    };

    mergeRepositoryBatchResults("scan.source", store, new Map([["scan.source:assembly:repo-a", batch]]));

    const snapshot = store.snapshot();
    assert.equal(snapshot.listEntities("ApplicationModule").length, 2);
    assert.ok(snapshot.getEntity("ApplicationModule", "mod-a"));
    assert.ok(snapshot.getEntity("ApplicationModule", "mod-b"));
  });
});

describe("collectRepositoryBatchProcessorErrors", () => {
  it("flattens per-processor batch errors with task id prefix", () => {
    const errors = collectRepositoryBatchProcessorErrors(
      new Map([
        [
          "scan.source:rest:repo-a",
          {
            outputs: {},
            errors: {
              "scan.source.java.rest/client-declarative": { message: "boom" },
            },
          },
        ],
      ]),
    );

    assert.equal(errors.size, 1);
    assert.ok(errors.has("scan.source:rest:repo-a:scan.source.java.rest/client-declarative"));
    assert.equal(
      errors.get("scan.source:rest:repo-a:scan.source.java.rest/client-declarative")?.message,
      "boom",
    );
  });
});
