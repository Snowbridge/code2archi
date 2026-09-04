import path from "node:path";
import { isWorkerRuntimeActive, workerRecordValue } from "../parallelism/worker-runtime.js";
import { readScanUtf8File } from "../scan-io/index.js";
import { METRIC_FILES_PROCESSED, METRIC_SLOTS_GENERATED } from "./metric-types.js";
import { getActiveProfiler } from "./profiling-state.js";

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

export function readProcessedUtf8File(absolutePath: string): string {
  return readScanUtf8File(absolutePath);
}

export function recordProcessedFile(absolutePath: string): void {
  const extension = path.extname(absolutePath).toLowerCase();
  if (!extension) {
    return;
  }

  recordMetricValue(METRIC_FILES_PROCESSED, 1, [extension]);
}

export function recordSlotGenerated(slotName: string): void {
  recordMetricValue(METRIC_SLOTS_GENERATED, 1, [slotName]);
}
