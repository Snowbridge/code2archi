import type { FlowStepDefinition } from "./types.js";

export function processorGroupFlowStep(
  id: string,
  label: string,
  processorCount: number,
): FlowStepDefinition | undefined {
  if (processorCount <= 0) {
    return undefined;
  }
  return { id, label, initialTotal: processorCount };
}

export function scopeDiscoveryFlowStep(
  sourceDirCount: number,
  scopeProcessorCount: number,
): FlowStepDefinition | undefined {
  if (scopeProcessorCount <= 0) {
    return undefined;
  }
  return {
    id: "1",
    label: "Repository discovery",
    initialTotal: Math.max(sourceDirCount, 1),
  };
}

export function defineFlowSteps(
  ...steps: readonly (FlowStepDefinition | undefined)[]
): FlowStepDefinition[] {
  return steps.filter((step): step is FlowStepDefinition => step !== undefined);
}
