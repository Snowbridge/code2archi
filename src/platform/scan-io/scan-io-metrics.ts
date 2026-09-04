import { isWorkerRuntimeActive, workerRecordValue } from "../parallelism/worker-runtime.js";
import {
  METRIC_FILES_CACHE_HIT,
  METRIC_FILES_CACHE_MISS,
} from "../profiling/metric-types.js";
import { getActiveProfiler } from "../profiling/profiling-state.js";

export type ScanIoCacheMetricKind =
  | "read"
  | "dir"
  | "parse.java"
  | "parse.kotlin"
  | "parse.nodejs";

function recordMetricValue(
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

export function recordScanIoCacheHit(kind: ScanIoCacheMetricKind): void {
  recordMetricValue(METRIC_FILES_CACHE_HIT, 1, [kind]);
}

export function recordScanIoCacheMiss(kind: ScanIoCacheMetricKind): void {
  recordMetricValue(METRIC_FILES_CACHE_MISS, 1, [kind]);
}
