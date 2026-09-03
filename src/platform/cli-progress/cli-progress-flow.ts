import { MultiBar, Presets, type SingleBar } from "cli-progress";
import type {
  FlowProgressReporter,
  FlowStepDefinition,
  StepProgressHandle,
} from "./types.js";

function createStepHandle(bar: SingleBar, redraw: () => void): StepProgressHandle {
  return {
    tick(count = 1): void {
      bar.increment(count);
      redraw();
    },
    setTotal(total: number): void {
      bar.setTotal(total);
      redraw();
    },
  };
}

export function createCliProgressFlow(steps: readonly FlowStepDefinition[]): FlowProgressReporter {
  const multibar = new MultiBar(
    {
      stream: process.stderr,
      hideCursor: true,
      clearOnComplete: false,
      emptyOnZero: true,
      format: " {bar} | {percentage}%",
    },
    Presets.shades_classic,
  );

  const bars = new Map<string, SingleBar>();
  const stepHandles = new Map<string, StepProgressHandle>();

  const redraw = (): void => {
    multibar.update();
  };

  for (const step of steps) {
    const bar = multibar.create(step.initialTotal, 0, {}, {
      format: ` {bar} | {percentage}% | ${step.label}`,
    });
    bars.set(step.id, bar);
    stepHandles.set(step.id, createStepHandle(bar, redraw));
  }

  // MultiBar redraws on a timer; synchronous scan/generate work blocks the event loop.
  // Force an initial paint so bars are visible before the first processor runs.
  redraw();

  let stopped = false;

  return {
    step(stepId: string): StepProgressHandle {
      const handle = stepHandles.get(stepId);
      if (!handle) {
        throw new Error(`Unknown flow progress step: ${stepId}`);
      }
      return handle;
    },

    stop(): void {
      if (stopped) {
        return;
      }
      stopped = true;
      multibar.stop();
    },

    fail(stepId: string): void {
      const bar = bars.get(stepId);
      if (bar) {
        bar.stop();
      }
      this.stop();
    },
  };
}
