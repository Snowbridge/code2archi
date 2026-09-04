import os from "node:os";
import { performance } from "node:perf_hooks";
import { Worker } from "node:worker_threads";
import { getLogger } from "../logging/index.js";
import { recordValue } from "../profiling/index.js";
import { METRIC_WORKER_PHASE_SETUP } from "../profiling/metric-types.js";
import { dispatchWorkerTask } from "./worker-dispatch.js";
import type { MainThreadBridge } from "./main-thread-bridge.js";
import type { ParallelismOptions } from "./parallelism-options.js";
import { effectiveThreadCount, shouldUseWorkerThreads } from "./parallelism-options.js";
import type {
  SerializableDiscoverySnapshot,
  SnapshotRepositoryFilterScope,
} from "./snapshot-serialization.js";
import type { WorkerHandlerId } from "./worker-handler-id.js";
import type {
  WorkerInboundMessage,
  WorkerOutboundMessage,
  WorkerPhaseSetupMessage,
  WorkerTaskRequest,
} from "./worker-messages.js";
import { setWorkerPhase } from "./worker-phase-context.js";
import { initWorkerRuntime, resetWorkerRuntime } from "./worker-runtime.js";
import type { ScanIoCacheOptions } from "../scan-io/scan-io-options.js";
import { DISABLED_SCAN_IO_CACHE_OPTIONS } from "../scan-io/scan-io-options.js";

export interface ParallelTask<TInput> {
  readonly taskId: string;
  readonly input: TInput;
}

export interface WorkerPhaseSetup {
  readonly phaseId: string;
  readonly snapshot: SerializableDiscoverySnapshot;
  readonly snapshotFilterScope: SnapshotRepositoryFilterScope;
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
  setupPhase(setup: WorkerPhaseSetup, bridge: MainThreadBridge): Promise<void>;
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
    private readonly scanIoCache: ScanIoCacheOptions,
  ) {}

  async setupPhase(setup: WorkerPhaseSetup, _bridge: MainThreadBridge): Promise<void> {
    const startedAt = performance.now();
    setWorkerPhase(setup.phaseId, setup.snapshot, setup.snapshotFilterScope);
    recordValue(METRIC_WORKER_PHASE_SETUP, performance.now() - startedAt, [setup.phaseId]);
  }

  async runTasks<TInput, TOutput>(
    options: WorkerPoolRunOptions<TInput, TOutput>,
  ): Promise<WorkerPoolRunResult<TOutput>> {
    const results = new Map<string, TOutput>();
    const errors = new Map<string, Error>();
    const pending = [...options.tasks];
    let stopScheduling = false;

    const workerLoop = async (): Promise<void> => {
      while (!stopScheduling && pending.length > 0) {
        const task = pending.shift()!;
        try {
          const result = runInlineTask(options, task, this.trackWorkerTaskMetrics);
          results.set(task.taskId, result);
        } catch (error) {
          const failure = error instanceof Error ? error : new Error(String(error));
          errors.set(task.taskId, failure);
          if (!this.options.continueOnError) {
            stopScheduling = true;
            break;
          }
        }
      }
    };

    await workerLoop();
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

  constructor(
    options: ParallelismOptions,
    trackWorkerTaskMetrics: boolean,
    scanIoCache: ScanIoCacheOptions,
  ) {
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
        workerData: { threadId, scanIoCache },
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

  async setupPhase(setup: WorkerPhaseSetup, bridge: MainThreadBridge): Promise<void> {
    await Promise.all(
      this.workers.map((slot) => this.sendPhaseSetup(slot, setup, bridge)),
    );
  }

  private sendPhaseSetup(
    slot: WorkerSlot,
    setup: WorkerPhaseSetup,
    bridge: MainThreadBridge,
  ): Promise<void> {
    const message: WorkerPhaseSetupMessage = {
      type: "phaseSetup",
      phaseId: setup.phaseId,
      snapshot: setup.snapshot,
      snapshotFilterScope: setup.snapshotFilterScope,
    };

    return new Promise<void>((resolve, reject) => {
      const onMessage = (outbound: WorkerOutboundMessage) => {
        if (
          outbound.type === "log" ||
          outbound.type === "progress" ||
          outbound.type === "metric"
        ) {
          bridge.dispatch(outbound);
          return;
        }

        if (outbound.type === "phaseSetupAck" && outbound.phaseId === setup.phaseId) {
          slot.worker.off("message", onMessage);
          resolve();
          return;
        }

        if (outbound.type === "taskError") {
          slot.worker.off("message", onMessage);
          reject(new Error(outbound.message));
        }
      };

      slot.worker.on("message", onMessage);
      slot.worker.postMessage(message satisfies WorkerInboundMessage);
    });
  }

  async runTasks<TInput, TOutput>(
    options: WorkerPoolRunOptions<TInput, TOutput>,
  ): Promise<WorkerPoolRunResult<TOutput>> {
    const results = new Map<string, TOutput>();
    const errors = new Map<string, Error>();
    const pending = [...options.tasks];
    let stopScheduling = false;

    const workerLoop = async (slot: WorkerSlot): Promise<void> => {
      while (!stopScheduling && pending.length > 0) {
        const task = pending.shift()!;
        try {
          const result = await this.runTaskOnWorker<TInput, TOutput>(slot, options, task);
          results.set(task.taskId, result);
        } catch (error) {
          const failure = error instanceof Error ? error : new Error(String(error));
          errors.set(task.taskId, failure);
          if (!this.options.continueOnError) {
            stopScheduling = true;
            break;
          }
        }
      }
    };

    await Promise.all(this.workers.map((slot) => workerLoop(slot)));
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

        if (message.type !== "taskResult" && message.type !== "taskError") {
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
      slot.worker.postMessage(request satisfies WorkerInboundMessage);
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
  scanIoCache: ScanIoCacheOptions = DISABLED_SCAN_IO_CACHE_OPTIONS,
): WorkerPool {
  if (shouldUseWorkerThreads(options)) {
    return new ThreadWorkerPool(options, trackWorkerTaskMetrics, scanIoCache);
  }
  return new InlineWorkerPool(options, trackWorkerTaskMetrics, scanIoCache);
}
