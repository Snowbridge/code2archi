export type MetricType = "counter" | "average" | "max" | "min";

export const METRIC_WORKER_TASK_SUCCESS = "run.worker.task.success";
export const METRIC_WORKER_TASK_ERROR = "run.worker.task.error";
export const METRIC_WORKER_TASK_DURATION = "run.worker.task.duration";
export const METRIC_WORKER_PHASE_SETUP = "run.worker.phase.setup";

export const METRIC_RUN_DURATION_TOTAL = "run.duration.total";
export const METRIC_RUN_STEP_DURATION = "run.step.duration";
export const METRIC_PROCESSOR_DURATION_AVG = "run.processor.duration.avg";
export const METRIC_PROCESSOR_DURATION_MAX = "run.processor.duration.max";
export const METRIC_PROCESSOR_DURATION_MIN = "run.processor.duration.min";
export const METRIC_PROCESSOR_SUCCESS = "run.processor.success";
export const METRIC_PROCESSOR_ERROR = "run.processor.error";
export const METRIC_FILES_PROCESSED = "run.files.processed";
export const METRIC_FILES_CACHE_HIT = "run.files.cache.hit";
export const METRIC_FILES_CACHE_MISS = "run.files.cache.miss";
export const METRIC_SLOTS_GENERATED = "run.slots.generated";

export const LABEL_STEP = "step";
export const LABEL_GROUP_ID = "groupId";
export const LABEL_ARTIFACT_ID = "artifactId";
export const LABEL_EXT = "ext";
export const LABEL_CACHE_KIND = "kind";
export const LABEL_SLOT_NAME = "slotName";
export const LABEL_PHASE_ID = "phaseId";

export const METRIC_LABEL_NAMES: Readonly<Record<string, readonly string[]>> = {
  [METRIC_RUN_STEP_DURATION]: [LABEL_STEP],
  [METRIC_PROCESSOR_DURATION_AVG]: [LABEL_GROUP_ID, LABEL_ARTIFACT_ID],
  [METRIC_PROCESSOR_DURATION_MAX]: [LABEL_GROUP_ID, LABEL_ARTIFACT_ID],
  [METRIC_PROCESSOR_DURATION_MIN]: [LABEL_GROUP_ID, LABEL_ARTIFACT_ID],
  [METRIC_PROCESSOR_SUCCESS]: [LABEL_GROUP_ID, LABEL_ARTIFACT_ID],
  [METRIC_PROCESSOR_ERROR]: [LABEL_GROUP_ID, LABEL_ARTIFACT_ID],
  [METRIC_FILES_PROCESSED]: [LABEL_EXT],
  [METRIC_FILES_CACHE_HIT]: [LABEL_CACHE_KIND],
  [METRIC_FILES_CACHE_MISS]: [LABEL_CACHE_KIND],
  [METRIC_SLOTS_GENERATED]: [LABEL_SLOT_NAME],
  [METRIC_WORKER_TASK_DURATION]: [LABEL_GROUP_ID, LABEL_ARTIFACT_ID],
  [METRIC_WORKER_PHASE_SETUP]: [LABEL_PHASE_ID],
};
