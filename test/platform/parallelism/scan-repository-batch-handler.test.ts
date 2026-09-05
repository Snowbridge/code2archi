import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildDiscoveryModelSnapshot } from "../../../src/discovery-model/discovery-model-snapshot.js";
import { createMainThreadBridge } from "../../../src/platform/parallelism/main-thread-bridge.js";
import { runScanRepositoryBatchTask } from "../../../src/platform/parallelism/handlers/scan-handlers.js";
import { serializeDiscoverySnapshot } from "../../../src/platform/parallelism/snapshot-serialization.js";
import { setWorkerPhase } from "../../../src/platform/parallelism/worker-phase-context.js";
import {
  METRIC_FILES_CACHE_HIT,
  METRIC_FILES_PROCESSED,
  METRIC_WORKER_TASK_DURATION,
} from "../../../src/platform/profiling/metric-types.js";
import { getValue, initProfiling } from "../../../src/platform/profiling/index.js";
import { resetProfilingState } from "../../../src/platform/profiling/profiling-state.js";
import { initScanIoCache, resetScanIoCache, DEFAULT_SCAN_IO_CACHE_OPTIONS } from "../../../src/platform/scan-io/index.js";
import {
  initWorkerRuntime,
  resetWorkerRuntime,
} from "../../../src/platform/parallelism/worker-runtime.js";
import { createTestTempDir } from "../../test-temp-dir.js";
import "../../../src/platform/processors/builtin-processors.js";

const mavenProcessor = {
  groupId: "scan.extract.assembly.maven",
  artifactId: "modules-and-dependencies",
} as const;

function setupMavenRepo(): { root: string; repositoryId: string; serialized: ReturnType<typeof serializeDiscoverySnapshot> } {
  const root = createTestTempDir("c2a-repo-batch-");
  const repoDir = path.join(root, "app");
  mkdirSync(repoDir, { recursive: true });
  writeFileSync(
    path.join(repoDir, "pom.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>app</artifactId>
  <version>1.0.0</version>
</project>`,
  );

  const snapshot = buildDiscoveryModelSnapshot({
    scanId: "scan-1",
    sourceRoot: root,
    sourceDirs: [root],
    repositoryCommonRoot: root,
    runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    entityArrays: {
      Repository: [
        {
          id: "repo-app",
          name: "app",
          namespace: "/app",
          localPath: repoDir,
          url: "",
          buildSystems: ["maven"],
        },
      ],
    },
  });

  return {
    root,
    repositoryId: "repo-app",
    serialized: serializeDiscoverySnapshot(snapshot),
  };
}

describe("runScanRepositoryBatchTask", () => {
  it("runs processors sequentially and reuses scan-io cache within batch", () => {
    const { repositoryId, serialized } = setupMavenRepo();
    initProfiling({ enabled: true });
    initScanIoCache(DEFAULT_SCAN_IO_CACHE_OPTIONS);
    const bridge = createMainThreadBridge(new Map());
    setWorkerPhase("scan.extract.assembly", serialized, "assembly");

    initWorkerRuntime({
      threadId: "worker-1",
      postEvent: (message) => bridge.dispatch(message),
      trackWorkerTaskMetrics: false,
    });

    try {
      const result = runScanRepositoryBatchTask({
        repositoryId,
        processors: [mavenProcessor, mavenProcessor],
        continueOnError: false,
      });

      const processorKey = `${mavenProcessor.groupId}/${mavenProcessor.artifactId}`;
      assert.ok(result.outputs[processorKey]);
      assert.equal(result.errors, undefined);

      const fileReads = getValue(METRIC_FILES_PROCESSED, [".xml"]) ?? 0;
      const readHits = getValue(METRIC_FILES_CACHE_HIT, ["read"]) ?? 0;
      assert.equal(fileReads, 1);
      assert.ok(readHits >= 1);
      assert.ok(
        (getValue(METRIC_WORKER_TASK_DURATION, [
          mavenProcessor.groupId,
          mavenProcessor.artifactId,
        ]) ?? 0) > 0,
      );
    } finally {
      resetWorkerRuntime();
      resetScanIoCache();
      resetProfilingState();
    }
  });

  it("collects per-processor errors when continueOnError is true", () => {
    const { repositoryId, serialized } = setupMavenRepo();
    setWorkerPhase("scan.extract.assembly", serialized, "assembly");
    const bridge = createMainThreadBridge(new Map());

    initWorkerRuntime({
      threadId: "worker-1",
      postEvent: (message) => bridge.dispatch(message),
      trackWorkerTaskMetrics: false,
    });

    try {
      const missingProcessor = {
        groupId: "scan.extract.assembly.maven",
        artifactId: "missing-artifact",
      };
      const result = runScanRepositoryBatchTask({
        repositoryId,
        processors: [mavenProcessor, missingProcessor],
        continueOnError: true,
      });

      const mavenKey = `${mavenProcessor.groupId}/${mavenProcessor.artifactId}`;
      const missingKey = `${missingProcessor.groupId}/${missingProcessor.artifactId}`;
      assert.ok(result.outputs[mavenKey]);
      assert.ok(result.errors?.[missingKey]);
      assert.match(result.errors?.[missingKey]?.message ?? "", /Processor not found/);
    } finally {
      resetWorkerRuntime();
    }
  });

  it("throws on first processor error when continueOnError is false", () => {
    const { repositoryId, serialized } = setupMavenRepo();
    setWorkerPhase("scan.extract.assembly", serialized, "assembly");
    const bridge = createMainThreadBridge(new Map());

    initWorkerRuntime({
      threadId: "worker-1",
      postEvent: (message) => bridge.dispatch(message),
      trackWorkerTaskMetrics: false,
    });

    try {
      assert.throws(
        () =>
          runScanRepositoryBatchTask({
            repositoryId,
            processors: [
              {
                groupId: "scan.extract.assembly.maven",
                artifactId: "missing-artifact",
              },
            ],
            continueOnError: false,
          }),
        /Processor not found/,
      );
    } finally {
      resetWorkerRuntime();
    }
  });
});
