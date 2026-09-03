import { createCliProgressFlow } from "./cli-progress-flow.js";
import { noopFlowProgress } from "./noop-flow-progress.js";
import type { CreateFlowProgressOptions, FlowProgressReporter } from "./types.js";

function isProgressEnabled(verbose: boolean): boolean {
  return !verbose && process.stderr.isTTY === true;
}

export function createFlowProgress(options: CreateFlowProgressOptions): FlowProgressReporter {
  if (!isProgressEnabled(options.verbose)) {
    return noopFlowProgress;
  }
  return createCliProgressFlow(options.steps);
}
