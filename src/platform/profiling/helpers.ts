import path from "node:path";
import { readFileSync } from "node:fs";
import { METRIC_FILES_PROCESSED, METRIC_SLOTS_GENERATED } from "./metric-types.js";
import { getActiveProfiler } from "./profiling-state.js";

export function readProcessedUtf8File(absolutePath: string): string {
  recordProcessedFile(absolutePath);
  return readFileSync(absolutePath, "utf8");
}

export function recordProcessedFile(absolutePath: string): void {
  const extension = path.extname(absolutePath).toLowerCase();
  if (!extension) {
    return;
  }

  getActiveProfiler().recordValue(METRIC_FILES_PROCESSED, 1, [extension]);
}

export function recordSlotGenerated(slotName: string): void {
  getActiveProfiler().recordValue(METRIC_SLOTS_GENERATED, 1, [slotName]);
}
