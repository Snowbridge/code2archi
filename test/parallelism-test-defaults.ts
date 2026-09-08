import type { ParallelismOptions } from "../src/platform/parallelism/parallelism-options.js";

export const testParallelismOptions: ParallelismOptions = {
  threads: 1,
  sync: true,
  continueOnError: false,
};

export const testParallelismContinueOnError: ParallelismOptions = {
  threads: 1,
  sync: true,
  continueOnError: true,
};

export const testParallelismWorkerPoolOptions: ParallelismOptions = {
  threads: 2,
  sync: false,
  continueOnError: false,
};
