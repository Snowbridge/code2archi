export interface ParallelismOptions {
  readonly threads: number;
  readonly sync: boolean;
  readonly continueOnError: boolean;
}

export function effectiveThreadCount(options: ParallelismOptions): number {
  if (options.sync) {
    return 1;
  }
  return options.threads;
}

export function shouldUseWorkerThreads(options: ParallelismOptions): boolean {
  return !options.sync && options.threads > 1;
}
