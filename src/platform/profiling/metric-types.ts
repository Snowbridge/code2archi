export type MetricType = "counter" | "average" | "max" | "min";

export const METRIC_RUN_DURATION_TOTAL = "run.duration.total";
export const METRIC_RUN_STEP_DURATION = "run.step.duration";
export const METRIC_PROCESSOR_DURATION_AVG = "run.processor.duration.avg";
export const METRIC_PROCESSOR_DURATION_MAX = "run.processor.duration.max";
export const METRIC_PROCESSOR_DURATION_MIN = "run.processor.duration.min";
export const METRIC_PROCESSOR_SUCCESS = "run.processor.success";
export const METRIC_PROCESSOR_ERROR = "run.processor.error";
export const METRIC_FILES_PROCESSED = "run.files.processed";
export const METRIC_SLOTS_GENERATED = "run.slots.generated";

export const LABEL_STEP = "step";
export const LABEL_GROUP_ID = "groupId";
export const LABEL_ARTIFACT_ID = "artifactId";
export const LABEL_EXT = "ext";
export const LABEL_SLOT_NAME = "slotName";

export const METRIC_LABEL_NAMES: Readonly<Record<string, readonly string[]>> = {
  [METRIC_RUN_STEP_DURATION]: [LABEL_STEP],
  [METRIC_PROCESSOR_DURATION_AVG]: [LABEL_GROUP_ID, LABEL_ARTIFACT_ID],
  [METRIC_PROCESSOR_DURATION_MAX]: [LABEL_GROUP_ID, LABEL_ARTIFACT_ID],
  [METRIC_PROCESSOR_DURATION_MIN]: [LABEL_GROUP_ID, LABEL_ARTIFACT_ID],
  [METRIC_PROCESSOR_SUCCESS]: [LABEL_GROUP_ID, LABEL_ARTIFACT_ID],
  [METRIC_PROCESSOR_ERROR]: [LABEL_GROUP_ID, LABEL_ARTIFACT_ID],
  [METRIC_FILES_PROCESSED]: [LABEL_EXT],
  [METRIC_SLOTS_GENERATED]: [LABEL_SLOT_NAME],
};
