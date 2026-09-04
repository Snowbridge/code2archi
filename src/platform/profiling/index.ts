import { performance } from "node:perf_hooks";
import { isWorkerRuntimeActive, workerRecordValue } from "../parallelism/worker-runtime.js";
import { getLogger } from "../logging/index.js";
import type { MetricType } from "./metric-types.js";
import { METRIC_RUN_DURATION_TOTAL } from "./metric-types.js";
import { NoopProfiler } from "./noop-profiler.js";
import { registerPredefinedMetrics } from "./predefined.js";
import { Profiler } from "./profiler.js";
import {
  getActiveProfiler,
  isProfilingEnabled,
  setActiveProfiler,
} from "./profiling-state.js";
import { writeMetricsReport } from "./report-writer.js";

let runStartedAt: number | undefined;

export function initProfiling(options: {
  enabled: boolean;
  continueOnError?: boolean;
}): void {
  runStartedAt = performance.now();

  if (options.enabled) {
    const profiler = new Profiler();
    registerPredefinedMetrics(profiler, { continueOnError: options.continueOnError });
    setActiveProfiler(profiler, true);
    return;
  }

  setActiveProfiler(new NoopProfiler(), false);
}

export function registerMetric(metricId: string, type: MetricType): void {
  getActiveProfiler().registerMetric(metricId, type);
}

export function recordValue(
  metricId: string,
  value: number,
  dimensions?: readonly string[],
): void {
  if (isWorkerRuntimeActive()) {
    workerRecordValue(metricId, value, dimensions);
    return;
  }
  getActiveProfiler().recordValue(metricId, value, dimensions);
}

export function getValue(
  metricId: string,
  dimensions?: readonly string[],
): number | undefined {
  return getActiveProfiler().getValue(metricId, dimensions);
}

export function finalizeProfiling(options: {
  command: string;
  verbose: boolean;
}): string | undefined {
  const activeProfiler = getActiveProfiler();
  if (!isProfilingEnabled() || !(activeProfiler instanceof Profiler)) {
    return undefined;
  }

  if (runStartedAt !== undefined) {
    activeProfiler.recordValue(METRIC_RUN_DURATION_TOTAL, performance.now() - runStartedAt);
  }

  const reportPath = writeMetricsReport(activeProfiler, options.command);
  getLogger("platform.profiling").info("metrics written", { path: reportPath });

  if (options.verbose) {
    console.error(`Metrics report: ${reportPath}`);
  }

  return reportPath;
}

export { recordProcessedFile, recordSlotGenerated } from "./helpers.js";
export type { MetricType } from "./metric-types.js";
