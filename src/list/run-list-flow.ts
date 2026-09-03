import type { AbstractProcessor } from "../platform/processors/processor.js";
import {
  filterProcessorsByGroupPatterns,
  listDistinctGroupIds,
} from "./filter-processors-by-group-patterns.js";
import {
  formatGroupsTable,
  formatProcessorsTable,
  type ProcessorListEntry,
} from "./format-processors-table.js";
import type { ListArgs } from "./validate-list-args.js";
import { writeProcessorsListJson } from "./write-processors-list-json.js";

function toProcessorListEntry(processor: AbstractProcessor<unknown, unknown>): ProcessorListEntry {
  return {
    groupId: processor.id.groupId,
    artifactId: processor.id.artifactId,
    version: processor.version,
    executionPolicy: processor.executionPolicy,
    description: processor.description,
  };
}

export function runListFlow(args: ListArgs): void {
  const processors = filterProcessorsByGroupPatterns(args.groupPatterns);

  if (args.toJson) {
    if (args.onlyGroups) {
      writeProcessorsListJson({ groups: listDistinctGroupIds(processors) });
      return;
    }

    writeProcessorsListJson({
      processors: processors.map(toProcessorListEntry),
    });
    return;
  }

  if (args.onlyGroups) {
    const table = formatGroupsTable(listDistinctGroupIds(processors));
    if (table.length > 0) {
      console.log(table);
    }
    return;
  }

  const table = formatProcessorsTable(processors.map(toProcessorListEntry));
  if (table.length > 0) {
    console.log(table);
  }
}
