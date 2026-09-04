import {
  METRIC_FILES_CACHE_HIT,
  METRIC_FILES_CACHE_MISS,
  METRIC_FILES_PROCESSED,
  METRIC_PROCESSOR_DURATION_AVG,
  METRIC_PROCESSOR_DURATION_MAX,
  METRIC_PROCESSOR_DURATION_MIN,
  METRIC_PROCESSOR_ERROR,
  METRIC_PROCESSOR_SUCCESS,
  METRIC_RUN_DURATION_TOTAL,
  METRIC_RUN_STEP_DURATION,
  METRIC_SLOTS_GENERATED,
  METRIC_WORKER_TASK_ERROR,
  METRIC_WORKER_TASK_SUCCESS,
  METRIC_WORKER_TASK_DURATION,
  METRIC_WORKER_PHASE_SETUP,
} from "./metric-types.js";
import type { Profiler } from "./profiler.js";

export function registerPredefinedMetrics(
  profiler: Profiler,
  options?: { continueOnError?: boolean },
): void {
  profiler.registerMetric(METRIC_RUN_DURATION_TOTAL, "max");
  profiler.registerMetric(METRIC_RUN_STEP_DURATION, "max");
  profiler.registerMetric(METRIC_PROCESSOR_DURATION_AVG, "average");
  profiler.registerMetric(METRIC_PROCESSOR_DURATION_MAX, "max");
  profiler.registerMetric(METRIC_PROCESSOR_DURATION_MIN, "min");
  profiler.registerMetric(METRIC_PROCESSOR_SUCCESS, "counter");
  profiler.registerMetric(METRIC_PROCESSOR_ERROR, "counter");
  profiler.registerMetric(METRIC_FILES_PROCESSED, "counter");
  profiler.registerMetric(METRIC_FILES_CACHE_HIT, "counter");
  profiler.registerMetric(METRIC_FILES_CACHE_MISS, "counter");
  profiler.registerMetric(METRIC_SLOTS_GENERATED, "counter");
  profiler.registerMetric(METRIC_WORKER_TASK_DURATION, "average");
  profiler.registerMetric(METRIC_WORKER_PHASE_SETUP, "max");

  if (options?.continueOnError) {
    profiler.registerMetric(METRIC_WORKER_TASK_SUCCESS, "counter");
    profiler.registerMetric(METRIC_WORKER_TASK_ERROR, "counter");
  }
}
