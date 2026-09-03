import type { FlowProgressReporter, StepProgressHandle } from "./types.js";

const noopStepHandle: StepProgressHandle = {
  tick(): void {},
  setTotal(): void {},
};

export const noopFlowProgress: FlowProgressReporter = {
  step(): StepProgressHandle {
    return noopStepHandle;
  },
  stop(): void {},
  fail(): void {},
};
