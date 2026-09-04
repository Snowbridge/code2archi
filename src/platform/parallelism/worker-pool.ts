import os from "node:os";
import { Worker } from "node:worker_threads";
import { getLogger } from "../logging/index.js";
import { dispatchWorkerTask } from "./worker-dispatch.js";
import type { MainThreadBridge } from "./main-thread-bridge.js";
import type { ParallelismOptions } from "./parallelism-options.js";
import { effectiveThreadCount, shouldUseWorkerThreads } from "./parallelism-options.js";
import type { WorkerHandlerId } from "./worker-handler-id.js";
import type { WorkerOutboundMessage, WorkerTaskRequest } from "./worker-messages.js";
import { initWorkerRuntime, resetWorkerRuntime } from "./worker-runtime.js";

export interface ParallelTask<TInput> {
  readonly taskId: string;
  readonly input: TInput;
}

export interface WorkerPoolRunOptions<TInput, TOutput> {
  readonly handlerId: WorkerHandlerId;
  readonly tasks: readonly ParallelTask<TInput>[];
  readonly bridge: MainThreadBridge;
}

export interface WorkerPoolRunResult<TOutput> {
  readonly results: ReadonlyMap<string, TOutput>;
  readonly errors: ReadonlyMap<string, Error>;
}

export interface WorkerPool {
  runTasks<TInput, TOutput>(
    options: WorkerPoolRunOptions<TInput, TOutput>,
  ): Promise<WorkerPoolRunResult<TOutput>>;
  shutdown(): void;
}

function runInlineTask<TInput, TOutput>(
  options: WorkerPoolRunOptions<TInput, TOutput>,
  task: ParallelTask<TInput>,
  trackWorkerTaskMetrics: boolean,
): TOutput {
  const request: WorkerTaskRequest = {
    taskId: task.taskId,
    handlerId: options.handlerId,
    input: task.input,
    trackWorkerTaskMetrics,
  };

  initWorkerRuntime({
    threadId: "main",
    postEvent: (message) => options.bridge.dispatch(message),
    trackWorkerTaskMetrics,
  });

  try {
    return dispatchWorkerTask(request) as TOutput;
  } finally {
    resetWorkerRuntime();
  }
}

class InlineWorkerPool implements WorkerPool {
  constructor(
    private readonly options: ParallelismOptions,
    private readonly trackWorkerTaskMetrics: boolean,
  ) {}

  async runTasks<TInput, TOutput>(
    options: WorkerPoolRunOptions<TInput, TOutput>,
  ): Promise<WorkerPoolRunResult<TOutput>> {
    const results = new Map<string, TOutput>();
    const errors = new Map<string, Error>();

    for (const task of options.tasks) {
      try {
        const result = runInlineTask(options, task, this.trackWorkerTaskMetrics);
        results.set(task.taskId, result);
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error));
        errors.set(task.taskId, failure);
        if (!this.options.continueOnError) {
          break;
        }
      }
    }

    return { results, errors };
  }

  shutdown(): void {}
}

interface WorkerSlot {
  readonly worker: Worker;
  readonly threadId: string;
  busy: boolean;
  pendingTaskId?: string;
  onMessage?: (message: WorkerOutboundMessage) => void;
  taskResolve?: (value: unknown) => void;
  taskReject?: (error: Error) => void;
}

class ThreadWorkerPool implements WorkerPool {
  private readonly workers: WorkerSlot[] = [];
  private readonly options: ParallelismOptions;
  private readonly trackWorkerTaskMetrics: boolean;

  constructor(options: ParallelismOptions, trackWorkerTaskMetrics: boolean) {
    this.options = options;
    this.trackWorkerTaskMetrics = trackWorkerTaskMetrics;
    const concurrency = effectiveThreadCount(options);

    if (options.threads > os.cpus().length) {
      getLogger("platform.parallelism").warn("threads exceed cpu count", {
        threads: options.threads,
        cpus: os.cpus().length,
      });
    }

    for (let index = 0; index < concurrency; index += 1) {
      const threadId = `worker-${index + 1}`;
      const worker = new Worker(new URL("./worker-entry.js", import.meta.url), {
        workerData: { threadId },
      });
      const slot: WorkerSlot = { worker, threadId, busy: false };
      worker.on("error", (error) => {
        this.failWorkerSlot(slot, error);
      });
      worker.on("exit", (code) => {
        if (code !== 0 && slot.busy) {
          this.failWorkerSlot(
            slot,
            new Error(`Worker ${threadId} exited with code ${code}`),
          );
        }
      });
      this.workers.push(slot);
    }
  }

  private failWorkerSlot(slot: WorkerSlot, error: Error): void {
    if (!slot.busy) {
      getLogger("platform.parallelism").warn("worker failed while idle", {
        threadId: slot.threadId,
        message: error.message,
      });
      return;
    }

    this.finishWorkerTask(slot, () => {
      slot.taskReject?.(error);
    });
  }

  private finishWorkerTask(slot: WorkerSlot, complete: () => void): void {
    if (slot.onMessage) {
      slot.worker.off("message", slot.onMessage);
      slot.onMessage = undefined;
    }
    slot.busy = false;
    slot.pendingTaskId = undefined;
    complete();
    slot.taskResolve = undefined;
    slot.taskReject = undefined;
  }

  async runTasks<TInput, TOutput>(
    options: WorkerPoolRunOptions<TInput, TOutput>,
  ): Promise<WorkerPoolRunResult<TOutput>> {
    const results = new Map<string, TOutput>();
    const errors = new Map<string, Error>();
    const concurrency = this.workers.length;

    for (let batchStart = 0; batchStart < options.tasks.length; batchStart += concurrency) {
      if (errors.size > 0 && !this.options.continueOnError) {
        break;
      }

      const batch = options.tasks.slice(batchStart, batchStart + concurrency);
      const batchOutcomes = await Promise.all(
        batch.map(async (task, index) => {
          try {
            const result = await this.runTaskOnWorker<TInput, TOutput>(
              this.workers[index]!,
              options,
              task,
            );
            return { taskId: task.taskId, result };
          } catch (error) {
            const failure = error instanceof Error ? error : new Error(String(error));
            return { taskId: task.taskId, error: failure };
          }
        }),
      );

      for (const outcome of batchOutcomes) {
        if ("error" in outcome && outcome.error) {
          errors.set(outcome.taskId, outcome.error);
          if (!this.options.continueOnError) {
            return { results, errors };
          }
          continue;
        }

        if ("result" in outcome) {
          results.set(outcome.taskId, outcome.result);
        }
      }
    }

    return { results, errors };
  }

  private runTaskOnWorker<TInput, TOutput>(
    slot: WorkerSlot,
    options: WorkerPoolRunOptions<TInput, TOutput>,
    task: ParallelTask<TInput>,
  ): Promise<TOutput> {
    const request: WorkerTaskRequest = {
      taskId: task.taskId,
      handlerId: options.handlerId,
      input: task.input,
      trackWorkerTaskMetrics: this.trackWorkerTaskMetrics,
    };

    return new Promise<TOutput>((resolve, reject) => {
      slot.busy = true;
      slot.pendingTaskId = task.taskId;
      slot.taskResolve = (value) => resolve(value as TOutput);
      slot.taskReject = reject;

      const onMessage = (message: WorkerOutboundMessage) => {
        if (message.type === "log" || message.type === "progress" || message.type === "metric") {
          options.bridge.dispatch(message);
          return;
        }

        if (message.taskId !== task.taskId) {
          return;
        }

        if (message.type === "taskResult") {
          this.finishWorkerTask(slot, () => resolve(message.result as TOutput));
          return;
        }

        if (message.type === "taskError") {
          const error = new Error(message.message);
          if (message.stack) {
            error.stack = message.stack;
          }
          this.finishWorkerTask(slot, () => reject(error));
        }
      };

      slot.onMessage = onMessage;
      slot.worker.on("message", onMessage);
      slot.worker.postMessage(request);
    });
  }

  shutdown(): void {
    for (const slot of this.workers) {
      void slot.worker.terminate();
    }
    this.workers.length = 0;
  }
}

export function createWorkerPool(
  options: ParallelismOptions,
  trackWorkerTaskMetrics: boolean,
): WorkerPool {
  if (shouldUseWorkerThreads(options)) {
    return new ThreadWorkerPool(options, trackWorkerTaskMetrics);
  }
  return new InlineWorkerPool(options, trackWorkerTaskMetrics);
}
