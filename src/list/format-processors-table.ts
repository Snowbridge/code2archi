import type { ProcessorExecutionPolicy } from "../platform/processors/processor.js";

export interface ProcessorListEntry {
  readonly groupId: string;
  readonly artifactId: string;
  readonly version: string;
  readonly executionPolicy: ProcessorExecutionPolicy;
  readonly description: string;
}

function columnWidth(values: readonly string[]): number {
  return values.reduce((max, value) => Math.max(max, value.length), 0);
}

function padCell(value: string, width: number): string {
  return value.padEnd(width, " ");
}

function formatTable(headers: readonly string[], rows: readonly string[][]): string {
  if (rows.length === 0) {
    return "";
  }

  const widths = headers.map((header, index) =>
    columnWidth([header, ...rows.map((row) => row[index] ?? "")]),
  );

  const formatRow = (cells: readonly string[]) =>
    cells.map((cell, index) => padCell(cell, widths[index] ?? 0)).join("  ");

  return [formatRow(headers), ...rows.map((row) => formatRow(row))].join("\n");
}

function compareEntries(a: ProcessorListEntry, b: ProcessorListEntry): number {
  const groupCompare = a.groupId.localeCompare(b.groupId);
  if (groupCompare !== 0) {
    return groupCompare;
  }
  return a.artifactId.localeCompare(b.artifactId);
}

function groupEntriesByGroupId(
  entries: readonly ProcessorListEntry[],
): ReadonlyMap<string, ProcessorListEntry[]> {
  const sorted = [...entries].sort(compareEntries);
  const groups = new Map<string, ProcessorListEntry[]>();

  for (const entry of sorted) {
    const group = groups.get(entry.groupId);
    if (group) {
      group.push(entry);
    } else {
      groups.set(entry.groupId, [entry]);
    }
  }

  return groups;
}

export function formatProcessorsTable(entries: readonly ProcessorListEntry[]): string {
  if (entries.length === 0) {
    return "";
  }

  const groups = groupEntriesByGroupId(entries);
  const processorHeaders = ["artifactId", "version", "executionPolicy", "description"];
  const processorRows = entries.map((entry) => [
    entry.artifactId,
    entry.version,
    entry.executionPolicy,
    entry.description,
  ]);
  const widths = processorHeaders.map((header, index) =>
    columnWidth([header, ...processorRows.map((row) => row[index] ?? "")]),
  );
  const formatProcessorRow = (cells: readonly string[]) =>
    cells.map((cell, index) => padCell(cell, widths[index] ?? 0)).join("  ");

  const sections: string[] = [formatProcessorRow(processorHeaders)];

  for (const [groupId, groupEntries] of groups) {
    sections.push("");
    sections.push(groupId);
    for (const entry of groupEntries) {
      sections.push(
        formatProcessorRow([
          entry.artifactId,
          entry.version,
          entry.executionPolicy,
          entry.description,
        ]),
      );
    }
  }

  return sections.join("\n");
}

export function formatGroupsTable(groupIds: readonly string[]): string {
  return formatTable(["groupId"], groupIds.map((groupId) => [groupId]));
}
