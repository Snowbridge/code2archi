import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { formatIso8601WithOffset, formatRunTimestamp } from "../timestamp.js";
import { METRIC_LABEL_NAMES } from "./metric-types.js";
import { formatMetricKey } from "./prometheus-key.js";
import type { Profiler } from "./profiler.js";

export interface MetricsReport {
  readonly _meta: {
    readonly command: string;
    readonly writtenAt: string;
  };
  readonly metrics: Record<string, number>;
}

export interface MetricsReportWriteOptions {
  readonly commandLine: string;
  readonly fileSlug: string;
}

export function buildMetricsReport(
  profiler: Profiler,
  commandLine: string,
): MetricsReport {
  const metrics: Record<string, number> = {};

  for (const series of profiler.listSeries()) {
    const labelNames = METRIC_LABEL_NAMES[series.metricId];
    const key = formatMetricKey(series.metricId, labelNames, series.dimensions);
    metrics[key] = series.value;
  }

  return {
    _meta: {
      command: commandLine,
      writtenAt: formatIso8601WithOffset(),
    },
    metrics,
  };
}

export function writeMetricsReport(
  profiler: Profiler,
  options: MetricsReportWriteOptions,
  outputDir: string = os.tmpdir(),
): string {
  const report = buildMetricsReport(profiler, options.commandLine);
  const timestamp = formatRunTimestamp();
  const baseName = `code2archi-metrics-${options.fileSlug}-${timestamp}.json`;
  const absolutePath = resolveUniqueFilePath(outputDir, baseName);

  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return absolutePath;
}

export function resolveUniqueMetricsReportPath(directory: string, baseName: string): string {
  return resolveUniqueFilePath(directory, baseName);
}

function resolveUniqueFilePath(directory: string, baseName: string): string {
  const extension = path.extname(baseName);
  const stem = baseName.slice(0, baseName.length - extension.length);
  let candidate = path.join(directory, baseName);
  let suffix = 2;

  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${stem}-${suffix}${extension}`);
    suffix += 1;
  }

  return candidate;
}
