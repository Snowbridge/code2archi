import { performance } from "node:perf_hooks";
import {
  METRIC_PROCESSOR_DURATION_AVG,
  METRIC_PROCESSOR_DURATION_MAX,
  METRIC_PROCESSOR_DURATION_MIN,
  METRIC_PROCESSOR_ERROR,
  METRIC_PROCESSOR_SUCCESS,
  METRIC_RUN_STEP_DURATION,
} from "../profiling/metric-types.js";
import { recordValue } from "../profiling/index.js";
import type { ProcessorId } from "../processors/processor.js";

export async function measureFlowStep(step: string, run: () => void | Promise<void>): Promise<void> {
  const startedAt = performance.now();
  try {
    await run();
  } finally {
    recordValue(METRIC_RUN_STEP_DURATION, performance.now() - startedAt, [step]);
  }
}

export function runProcessorWithMetrics<T>(
  processorId: ProcessorId,
  run: () => T,
): T {
  const dimensions = [processorId.groupId, processorId.artifactId];
  const startedAt = performance.now();

  try {
    const result = run();
    const durationMs = performance.now() - startedAt;
    recordValue(METRIC_PROCESSOR_SUCCESS, 1, dimensions);
    recordValue(METRIC_PROCESSOR_DURATION_AVG, durationMs, dimensions);
    recordValue(METRIC_PROCESSOR_DURATION_MAX, durationMs, dimensions);
    recordValue(METRIC_PROCESSOR_DURATION_MIN, durationMs, dimensions);
    return result;
  } catch (error) {
    recordValue(METRIC_PROCESSOR_ERROR, 1, dimensions);
    throw error;
  }
}
