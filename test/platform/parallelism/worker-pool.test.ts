import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { buildDiscoveryModelSnapshot } from "../../../src/discovery-model/discovery-model-snapshot.js";
import { createMainThreadBridge } from "../../../src/platform/parallelism/main-thread-bridge.js";
import { dispatchWorkerTask } from "../../../src/platform/parallelism/worker-dispatch.js";
import { createWorkerPool } from "../../../src/platform/parallelism/worker-pool.js";
import { WORKER_HANDLER_SCAN_PROCESSOR, WORKER_HANDLER_SCAN_SCOPE_UNIT } from "../../../src/platform/parallelism/worker-handler-id.js";
import { serializeDiscoverySnapshot } from "../../../src/platform/parallelism/snapshot-serialization.js";
import { METRIC_WORKER_TASK_ERROR, METRIC_WORKER_TASK_SUCCESS } from "../../../src/platform/profiling/metric-types.js";
import { initProfiling, getValue } from "../../../src/platform/profiling/index.js";
import { resetProfilingState } from "../../../src/platform/profiling/profiling-state.js";
import { initWorkerRuntime, resetWorkerRuntime } from "../../../src/platform/parallelism/worker-runtime.js";
import { initLogging, resetLoggingForTests } from "../../../src/platform/logging/index.js";
import "../../../src/platform/processors/builtin-processors.js";
import { createTestTempDir } from "../../test-temp-dir.js";
import { testParallelismContinueOnError, testParallelismOptions } from "../../parallelism-test-defaults.js";

describe("worker pool", () => {
  it("runs scope unit tasks inline with sync mode", async () => {
    const sourceDir = createTestTempDir("c2a-scope-unit-");
    const progressTicks: string[] = [];
    const bridge = createMainThreadBridge(
      new Map([
        [
          "1",
          {
            tick() {
              progressTicks.push("tick");
            },
            setTotal() {},
          },
        ],
      ]),
    );

    const pool = createWorkerPool(testParallelismOptions, false);
    try {
      const { results, errors } = await pool.runTasks({
        handlerId: WORKER_HANDLER_SCAN_SCOPE_UNIT,
        bridge,
        tasks: [
          {
            taskId: "scope:dir",
            input: {
              processor: { groupId: "scan.scope", artifactId: "unversioned-folders" },
              sourceDirs: [sourceDir],
              unit: { kind: "sourceDir", path: sourceDir },
              progressStepId: "1",
            },
          },
        ],
      });

      assert.equal(errors.size, 0);
      assert.equal(results.size, 1);
      assert.equal(progressTicks.length, 1);
    } finally {
      pool.shutdown();
    }
  });

  it("runs scope unit tasks in worker threads", async () => {
    const sourceDir = createTestTempDir("c2a-scope-thread-");
    const progressTicks: string[] = [];
    const bridge = createMainThreadBridge(
      new Map([
        [
          "1",
          {
            tick() {
              progressTicks.push("tick");
            },
            setTotal() {},
          },
        ],
      ]),
    );

    const pool = createWorkerPool({ threads: 2, sync: false, continueOnError: false }, false);
    try {
      const { results, errors } = await pool.runTasks({
        handlerId: WORKER_HANDLER_SCAN_SCOPE_UNIT,
        bridge,
        tasks: [
          {
            taskId: "scope:dir",
            input: {
              processor: { groupId: "scan.scope", artifactId: "unversioned-folders" },
              sourceDirs: [sourceDir],
              unit: { kind: "sourceDir", path: sourceDir },
              progressStepId: "1",
            },
          },
        ],
      });

      assert.equal(errors.size, 0);
      assert.equal(results.size, 1);
      assert.equal(progressTicks.length, 1);
    } finally {
      pool.shutdown();
    }
  });

  it("completes all work-queue tasks with multiple workers", async () => {
    const bridge = createMainThreadBridge(new Map());
    const pool = createWorkerPool({ threads: 4, sync: false, continueOnError: false }, false);
    const tasks = Array.from({ length: 20 }, (_, index) => {
      const sourceDir = createTestTempDir(`c2a-wq-${index}-`);
      return {
        taskId: `scope:${index}`,
        input: {
          processor: { groupId: "scan.scope", artifactId: "unversioned-folders" },
          sourceDirs: [sourceDir],
          unit: { kind: "sourceDir" as const, path: sourceDir },
        },
      };
    });

    try {
      const { results, errors } = await pool.runTasks({
        handlerId: WORKER_HANDLER_SCAN_SCOPE_UNIT,
        bridge,
        tasks,
      });

      assert.equal(errors.size, 0);
      assert.equal(results.size, 20);
    } finally {
      pool.shutdown();
    }
  });

  it("setupPhase delivers snapshot to workers for scan.extract tasks", async () => {
    const root = createTestTempDir("c2a-phase-setup-");
    const repoDir = path.join(root, "app");
    const { mkdirSync, writeFileSync } = await import("node:fs");
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

    const bridge = createMainThreadBridge(new Map());
    const pool = createWorkerPool({ threads: 2, sync: false, continueOnError: false }, false);

    try {
      await pool.setupPhase(
        {
          phaseId: "scan.extract.assembly",
          snapshot: serializeDiscoverySnapshot(snapshot),
          snapshotFilterScope: "assembly",
        },
        bridge,
      );

      const { results, errors } = await pool.runTasks({
        handlerId: WORKER_HANDLER_SCAN_PROCESSOR,
        bridge,
        tasks: [
          {
            taskId: "maven:repo-app",
            input: {
              processor: {
                groupId: "scan.extract.assembly.maven",
                artifactId: "modules-and-dependencies",
              },
              repositoryId: "repo-app",
            },
          },
        ],
      });

      assert.equal(errors.size, 0);
      assert.equal(results.size, 1);
    } finally {
      pool.shutdown();
    }
  });

  it("records worker task success and error metrics with continue-on-error profiling", async () => {
    const okDir = createTestTempDir("c2a-worker-ok-");
    initLogging({ logLevel: "INFO", verbose: false });
    initProfiling({ enabled: true, continueOnError: true });

    const bridge = createMainThreadBridge(new Map());
    const pool = createWorkerPool(testParallelismContinueOnError, true);

    try {
      const { errors } = await pool.runTasks({
        handlerId: WORKER_HANDLER_SCAN_SCOPE_UNIT,
        bridge,
        tasks: [
          {
            taskId: "ok",
            input: {
              processor: { groupId: "scan.scope", artifactId: "unversioned-folders" },
              sourceDirs: [okDir],
              unit: { kind: "sourceDir", path: okDir },
            },
          },
          {
            taskId: "bad",
            input: {
              processor: { groupId: "scan.scope", artifactId: "missing-processor" },
              sourceDirs: [okDir],
              unit: { kind: "sourceDir", path: okDir },
            },
          },
        ],
      });
      assert.equal(errors.size, 1);
      assert.equal(getValue(METRIC_WORKER_TASK_SUCCESS), 1);
      assert.equal(getValue(METRIC_WORKER_TASK_ERROR), 1);
    } finally {
      pool.shutdown();
      resetLoggingForTests();
      resetProfilingState();
    }
  });
});

describe("dispatchWorkerTask", () => {
  it("increments worker task success metric when tracking is enabled", () => {
    const sourceDir = createTestTempDir("c2a-worker-metric-");
    const bridge = createMainThreadBridge(new Map());
    initProfiling({ enabled: true, continueOnError: true });

    initWorkerRuntime({
      threadId: "main",
      postEvent: (message) => bridge.dispatch(message),
      trackWorkerTaskMetrics: true,
    });

    try {
      dispatchWorkerTask({
        taskId: "t1",
        handlerId: WORKER_HANDLER_SCAN_SCOPE_UNIT,
        trackWorkerTaskMetrics: true,
        input: {
          processor: { groupId: "scan.scope", artifactId: "unversioned-folders" },
          sourceDirs: [sourceDir],
          unit: { kind: "sourceDir", path: sourceDir },
        },
      });
      assert.equal(getValue(METRIC_WORKER_TASK_SUCCESS), 1);
      assert.equal(getValue(METRIC_WORKER_TASK_ERROR), undefined);
    } finally {
      resetWorkerRuntime();
      resetProfilingState();
    }
  });
});
