export interface StepProgressHandle {
  tick(count?: number): void;
  setTotal(total: number): void;
}

export interface FlowProgressReporter {
  step(stepId: string): StepProgressHandle;
  stop(): void;
  fail(stepId: string): void;
}

export interface FlowStepDefinition {
  readonly id: string;
  readonly label: string;
  readonly initialTotal: number;
}

export interface CreateFlowProgressOptions {
  readonly verbose: boolean;
  readonly steps: readonly FlowStepDefinition[];
}
