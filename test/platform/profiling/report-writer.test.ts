import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { registerPredefinedMetrics } from "../../../src/platform/profiling/predefined.js";
import { Profiler } from "../../../src/platform/profiling/profiler.js";
import { packageVersion } from "../../../src/package-version.js";
import { buildMetricsReport, resolveUniqueMetricsReportPath, writeMetricsReport } from "../../../src/platform/profiling/report-writer.js";
import { initProfiling, finalizeProfiling } from "../../../src/platform/profiling/index.js";
import { resetProfilingState } from "../../../src/platform/profiling/profiling-state.js";

describe("metrics report writer", () => {
  it("builds report with prometheus-style keys", () => {
    const profiler = new Profiler();
    registerPredefinedMetrics(profiler);
    profiler.recordValue("run.duration.total", 100);
    profiler.recordValue("run.step.duration", 40, ["1"]);

    const report = buildMetricsReport(profiler, "code2archi scan /src --profile");
    assert.equal(report._meta.command, "code2archi scan /src --profile");
    assert.equal(report._meta.version, packageVersion);
    assert.ok(report._meta.writtenAt.length > 0);
    assert.equal(report.metrics["run.duration.total"], 100);
    assert.equal(report.metrics['run.step.duration{step="1"}'], 40);
  });

  it("resolves filename collisions", () => {
    const outputDir = mkdtempSync(path.join(os.tmpdir(), "c2a-metrics-test-"));

    try {
      const baseName = "code2archi-metrics-scan-fixed.json";
      const first = path.join(outputDir, baseName);
      writeFileSync(first, "{}", "utf8");

      const second = resolveUniqueMetricsReportPath(outputDir, baseName);
      assert.notEqual(first, second);
      assert.ok(second.endsWith("-2.json"));
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

describe("profiling lifecycle", () => {
  it("no-op when disabled", () => {
    resetProfilingState();
    initProfiling({ enabled: false });
    assert.equal(finalizeProfiling({ command: "scan", verbose: false }), undefined);
  });

  it("writes full command line into report meta", () => {
    resetProfilingState();
    initProfiling({ enabled: true });
    const reportPath = finalizeProfiling({
      command: "scan",
      verbose: false,
      commandLine: "code2archi scan /src --threads 10 --profile",
    });
    assert.ok(reportPath);

    const report = JSON.parse(readFileSync(reportPath!, "utf8")) as {
      _meta: { command: string; version: string };
      metrics: Record<string, number>;
    };
    assert.equal(report._meta.command, "code2archi scan /src --threads 10 --profile");
    assert.equal(report._meta.version, packageVersion);
    assert.ok(typeof report.metrics["run.duration.total"] === "number");

    rmSync(reportPath!, { force: true });
    resetProfilingState();
  });

  it("writes report when enabled", () => {
    resetProfilingState();
    initProfiling({ enabled: true });
    const reportPath = finalizeProfiling({ command: "scan", verbose: false });
    assert.ok(reportPath);
    assert.ok(existsSync(reportPath!));

    const report = JSON.parse(readFileSync(reportPath!, "utf8")) as {
      metrics: Record<string, number>;
    };
    assert.ok(typeof report.metrics["run.duration.total"] === "number");

    rmSync(reportPath!, { force: true });
    resetProfilingState();
  });
});
