import type { StepProgressHandle } from "./types.js";
import { createMainThreadBridge, createWorkerPool } from "../parallelism/index.js";
import type { ParallelismOptions } from "../parallelism/parallelism-options.js";
import type { ProcessorGroupParallelContext } from "../processors/run-create-intent-processor-group.js";
import type { FlowProgressReporter } from "./types.js";

export function createFlowParallelContext(
  parallelism: ParallelismOptions,
  progress: FlowProgressReporter,
  stepIds: readonly string[],
  profileEnabled: boolean,
): {
  readonly context: ProcessorGroupParallelContext;
  readonly shutdown: () => void;
} {
  const progressByStep = new Map<string, StepProgressHandle>();
  for (const stepId of stepIds) {
    progressByStep.set(stepId, progress.step(stepId));
  }

  const bridge = createMainThreadBridge(progressByStep);
  const pool = createWorkerPool(
    parallelism,
    profileEnabled && parallelism.continueOnError,
  );

  return {
    context: {
      pool,
      bridge,
      continueOnError: parallelism.continueOnError,
    },
    shutdown: () => {
      pool.shutdown();
    },
  };
}
