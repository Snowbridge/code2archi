import type { MetricType } from "./metric-types.js";

export class NoopProfiler {
  registerMetric(_metricId: string, _type: MetricType): void {}

  recordValue(
    _metricId: string,
    _value: number,
    _dimensions?: readonly string[],
  ): void {}

  getValue(_metricId: string, _dimensions?: readonly string[]): number | undefined {
    return undefined;
  }

  listSeries(): ReadonlyArray<{
    metricId: string;
    dimensions: readonly string[];
    value: number;
  }> {
    return [];
  }
}
