import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMainThreadBridge } from "../../../src/platform/parallelism/main-thread-bridge.js";
import { dispatchWorkerTask } from "../../../src/platform/parallelism/worker-dispatch.js";
import { createWorkerPool } from "../../../src/platform/parallelism/worker-pool.js";
import { WORKER_HANDLER_SCAN_SCOPE_UNIT } from "../../../src/platform/parallelism/worker-handler-id.js";
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
