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
  ): WorkerPoolRunResult<TOutput>;
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

  runTasks<TInput, TOutput>(
    options: WorkerPoolRunOptions<TInput, TOutput>,
  ): WorkerPoolRunResult<TOutput> {
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
  lock?: Int32Array;
  pendingTaskId?: string;
  taskResult?: unknown;
  taskError?: Error;
  onMessage?: (message: WorkerOutboundMessage) => void;
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
      this.workers.push({ worker, threadId, busy: false });
    }
  }

  runTasks<TInput, TOutput>(
    options: WorkerPoolRunOptions<TInput, TOutput>,
  ): WorkerPoolRunResult<TOutput> {
    const results = new Map<string, TOutput>();
    const errors = new Map<string, Error>();
    const concurrency = this.workers.length;

    for (let batchStart = 0; batchStart < options.tasks.length; batchStart += concurrency) {
      if (errors.size > 0 && !this.options.continueOnError) {
        break;
      }

      const batch = options.tasks.slice(batchStart, batchStart + concurrency);
      const batchStates = batch.map((task, index) =>
        this.startTaskOnWorker(this.workers[index]!, options, task),
      );

      for (const state of batchStates) {
        try {
          const result = this.awaitTask<TOutput>(state);
          results.set(state.taskId, result);
        } catch (error) {
          const failure = error instanceof Error ? error : new Error(String(error));
          errors.set(state.taskId, failure);
          if (!this.options.continueOnError) {
            return { results, errors };
          }
        }
      }
    }

    return { results, errors };
  }

  private startTaskOnWorker<TInput>(
    slot: WorkerSlot,
    options: WorkerPoolRunOptions<TInput, unknown>,
    task: ParallelTask<TInput>,
  ): {
    readonly taskId: string;
    readonly slot: WorkerSlot;
    readonly lock: Int32Array;
    readonly bridge: MainThreadBridge;
  } {
    const request: WorkerTaskRequest = {
      taskId: task.taskId,
      handlerId: options.handlerId,
      input: task.input,
      trackWorkerTaskMetrics: this.trackWorkerTaskMetrics,
    };

    const lock = new Int32Array(new SharedArrayBuffer(4));
    slot.busy = true;
    slot.pendingTaskId = task.taskId;
    slot.lock = lock;
    slot.taskResult = undefined;
    slot.taskError = undefined;

    const onMessage = (message: WorkerOutboundMessage) => {
      if (message.type === "log" || message.type === "progress" || message.type === "metric") {
        options.bridge.dispatch(message);
        return;
      }

      if (message.taskId !== task.taskId) {
        return;
      }

      if (message.type === "taskResult") {
        slot.taskResult = message.result;
      } else if (message.type === "taskError") {
        const error = new Error(message.message);
        if (message.stack) {
          error.stack = message.stack;
        }
        slot.taskError = error;
      }

      Atomics.store(lock, 0, 1);
      Atomics.notify(lock, 0, 1);
    };

    slot.onMessage = onMessage;
    slot.worker.on("message", onMessage);
    slot.worker.postMessage(request);

    return { taskId: task.taskId, slot, lock, bridge: options.bridge };
  }

  private awaitTask<TOutput>(state: {
    readonly taskId: string;
    readonly slot: WorkerSlot;
    readonly lock: Int32Array;
  }): TOutput {
    while (Atomics.load(state.lock, 0) === 0) {
      Atomics.wait(state.lock, 0, 0, 50);
    }

    const slot = state.slot;
    if (slot.onMessage) {
      slot.worker.off("message", slot.onMessage);
      slot.onMessage = undefined;
    }
    slot.busy = false;
    slot.lock = undefined;
    slot.pendingTaskId = undefined;

    if (slot.taskError) {
      const error = slot.taskError;
      slot.taskError = undefined;
      throw error;
    }

    const result = slot.taskResult as TOutput;
    slot.taskResult = undefined;
    return result;
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
