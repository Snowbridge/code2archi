import type { StepProgressHandle } from "../cli-progress/types.js";
import { writeBridgedWorkerLog } from "../logging/logging.js";
import { getActiveProfiler } from "../profiling/profiling-state.js";
import type { WorkerOutboundMessage } from "./worker-messages.js";

export interface MainThreadBridge {
  readonly dispatch: (message: WorkerOutboundMessage) => void;
  readonly createProgressProxy: (stepId: string) => StepProgressHandle;
}

export function createMainThreadBridge(
  progressByStep: ReadonlyMap<string, StepProgressHandle>,
): MainThreadBridge {
  return {
    dispatch(message: WorkerOutboundMessage): void {
      switch (message.type) {
        case "log": {
          writeBridgedWorkerLog({
            threadId: message.threadId,
            loggerName: message.loggerName,
            level: message.level,
            message: message.message,
            context: message.context,
          });
          break;
        }
        case "progress": {
          const handle = progressByStep.get(message.stepId);
          if (!handle) {
            return;
          }
          if (message.setTotal !== undefined) {
            handle.setTotal(message.setTotal);
          }
          if (message.tick !== undefined) {
            handle.tick(message.tick);
          }
          break;
        }
        case "metric":
          getActiveProfiler().recordValue(message.metricId, message.value, message.dimensions);
          break;
        case "taskResult":
        case "taskError":
          break;
        default:
          break;
      }
    },
    createProgressProxy(stepId: string): StepProgressHandle {
      return {
        tick(count = 1) {
          const handle = progressByStep.get(stepId);
          handle?.tick(count);
        },
        setTotal(total) {
          const handle = progressByStep.get(stepId);
          handle?.setTotal(total);
        },
      };
    },
  };
}
