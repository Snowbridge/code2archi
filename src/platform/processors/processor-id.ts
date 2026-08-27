import type { ProcessorGroupId } from "../../cli/processor-groups.js";

export interface ProcessorId {
  readonly groupId: ProcessorGroupId;
  readonly artifactId: string;
}

export function processorKey(id: ProcessorId): string {
  return `${id.groupId}/${id.artifactId}`;
}
