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

export function formatProcessorsTable(entries: readonly ProcessorListEntry[]): string {
  return formatTable(
    ["groupId", "artifactId", "version", "executionPolicy", "description"],
    entries.map((entry) => [
      entry.groupId,
      entry.artifactId,
      entry.version,
      entry.executionPolicy,
      entry.description,
    ]),
  );
}

export function formatGroupsTable(groupIds: readonly string[]): string {
  return formatTable(["groupId"], groupIds.map((groupId) => [groupId]));
}
