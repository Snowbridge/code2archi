import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildDiscoveryModelSnapshot } from "../../../src/discovery-model/discovery-model-snapshot.js";
import { createMainThreadBridge } from "../../../src/platform/parallelism/main-thread-bridge.js";
import { dispatchWorkerTask } from "../../../src/platform/parallelism/worker-dispatch.js";
import {
  serializeDiscoverySnapshot,
} from "../../../src/platform/parallelism/snapshot-serialization.js";
import { WORKER_HANDLER_SCAN_PROCESSOR } from "../../../src/platform/parallelism/worker-handler-id.js";
import { setWorkerPhase } from "../../../src/platform/parallelism/worker-phase-context.js";
import { getOrBuildRepositorySnapshot } from "../../../src/platform/parallelism/worker-snapshot-cache.js";
import {
  METRIC_FILES_PROCESSED,
  METRIC_PROCESSOR_DURATION_AVG,
  METRIC_PROCESSOR_SUCCESS,
} from "../../../src/platform/profiling/metric-types.js";
import {
  finalizeProfiling,
  getValue,
  initProfiling,
  recordProcessedFile,
} from "../../../src/platform/profiling/index.js";
import { resetProfilingState } from "../../../src/platform/profiling/profiling-state.js";
import {
  initWorkerRuntime,
  resetWorkerRuntime,
} from "../../../src/platform/parallelism/worker-runtime.js";
import { createTestTempDir } from "../../test-temp-dir.js";
import "../../../src/platform/processors/builtin-processors.js";
import { runScanFlow } from "../../../src/scan/run-scan-flow.js";

describe("worker metrics bridge", () => {
  it("routes recordProcessedFile from worker runtime to main registry", () => {
    initProfiling({ enabled: true });
    const bridge = createMainThreadBridge(new Map());

    initWorkerRuntime({
      threadId: "worker-1",
      postEvent: (message) => bridge.dispatch(message),
      trackWorkerTaskMetrics: false,
    });

    try {
      recordProcessedFile("/tmp/example.java");
      assert.equal(getValue(METRIC_FILES_PROCESSED, [".java"]), 1);
    } finally {
      resetWorkerRuntime();
      resetProfilingState();
    }
  });

  it("routes processor metrics from dispatchWorkerTask through bridge", () => {
    const root = createTestTempDir("c2a-worker-metrics-");
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

    initProfiling({ enabled: true });
    const bridge = createMainThreadBridge(new Map());
    const serialized = serializeDiscoverySnapshot(snapshot);
    setWorkerPhase("scan.extract.assembly", serialized, "assembly");

    initWorkerRuntime({
      threadId: "worker-1",
      postEvent: (message) => bridge.dispatch(message),
      trackWorkerTaskMetrics: false,
    });

    try {
      dispatchWorkerTask({
        taskId: "maven:repo-app",
        handlerId: WORKER_HANDLER_SCAN_PROCESSOR,
        trackWorkerTaskMetrics: false,
        input: {
          processor: {
            groupId: "scan.extract.assembly.maven",
            artifactId: "modules-and-dependencies",
          },
          repositoryId: "repo-app",
        },
      });

      assert.equal(
        getValue(METRIC_PROCESSOR_SUCCESS, [
          "scan.extract.assembly.maven",
          "modules-and-dependencies",
        ]),
        1,
      );
      assert.ok(
        (getValue(METRIC_PROCESSOR_DURATION_AVG, [
          "scan.extract.assembly.maven",
          "modules-and-dependencies",
        ]) ?? 0) > 0,
      );
      assert.ok((getValue(METRIC_FILES_PROCESSED, [".xml"]) ?? 0) > 0);
    } finally {
      resetWorkerRuntime();
      resetProfilingState();
    }
  });
});

describe("worker snapshot cache", () => {
  it("reuses deserialized snapshot for the same repository", () => {
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
        ],
      },
    });

    const serialized = serializeDiscoverySnapshot(snapshot);
    setWorkerPhase("scan.extract.assembly", serialized, "assembly");

    const first = getOrBuildRepositorySnapshot("repo-a");
    const second = getOrBuildRepositorySnapshot("repo-a");
    assert.equal(first, second);
  });
});

describe("parallel scan profiling", () => {
  it("records processor and file metrics with parallel scan.extract", async () => {
    const root = createTestTempDir("c2a-parallel-profile-");
    const sourceDir = path.join(root, "src");
    const outputDir = path.join(root, "out");
    mkdirSync(sourceDir);
    mkdirSync(outputDir);
    writeFileSync(
      path.join(sourceDir, "pom.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>demo</artifactId>
  <version>1.0.0</version>
</project>`,
    );

    initProfiling({ enabled: true });
    try {
      await runScanFlow({
        sourceDirs: [sourceDir],
        outputDir,
        force: false,
        scanId: "test-parallel-profile",
        runStartedAt: new Date("2026-08-27T09:00:00.000Z"),
        verbose: false,
        profile: false,
        parallelism: { threads: 2, sync: false, continueOnError: false },
        processorFilters: {
          with: ["scan.scope.unversioned-folders", "scan.extract.assembly.maven"],
          without: [],
          withOnly: [],
        },
      });

      const reportPath = finalizeProfiling({ command: "scan", verbose: false });
      assert.ok(reportPath);

      const report = JSON.parse(readFileSync(reportPath!, "utf8")) as {
        metrics: Record<string, number>;
      };

      const processorMetricKey = Object.keys(report.metrics).find((key) =>
        key.startsWith("run.processor.duration.avg{"),
      );
      assert.ok(processorMetricKey, "expected run.processor.duration.avg in profile report");
      assert.ok(
        Object.keys(report.metrics).some((key) => key.startsWith('run.files.processed{ext=".xml"')),
        "expected run.files.processed for pom.xml",
      );
    } finally {
      resetProfilingState();
    }
  });
});
