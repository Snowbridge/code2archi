import type { MetricType } from "./metric-types.js";
import { dimensionsToKey } from "./prometheus-key.js";

interface MetricDefinition {
  readonly type: MetricType;
}

interface MetricSeriesState {
  counterSum: number;
  averageSum: number;
  averageCount: number;
  maxValue: number;
  minValue: number;
  hasValue: boolean;
}

export class Profiler {
  private readonly definitions = new Map<string, MetricDefinition>();
  private readonly series = new Map<string, Map<string, MetricSeriesState>>();

  registerMetric(metricId: string, type: MetricType): void {
    if (this.definitions.has(metricId)) {
      throw new Error(`Metric already registered: ${metricId}`);
    }
    this.definitions.set(metricId, { type });
    this.series.set(metricId, new Map());
  }

  recordValue(metricId: string, value: number, dimensions: readonly string[] = []): void {
    const definition = this.definitions.get(metricId);
    if (!definition) {
      throw new Error(`Metric not registered: ${metricId}`);
    }

    const dimensionKey = dimensionsToKey(dimensions);
    const metricSeries = this.series.get(metricId)!;
    let state = metricSeries.get(dimensionKey);
    if (!state) {
      state = {
        counterSum: 0,
        averageSum: 0,
        averageCount: 0,
        maxValue: value,
        minValue: value,
        hasValue: false,
      };
      metricSeries.set(dimensionKey, state);
    }

    switch (definition.type) {
      case "counter":
        state.counterSum += value;
        break;
      case "average":
        state.averageSum += value;
        state.averageCount += 1;
        state.hasValue = true;
        break;
      case "max":
        state.maxValue = state.hasValue ? Math.max(state.maxValue, value) : value;
        state.hasValue = true;
        break;
      case "min":
        state.minValue = state.hasValue ? Math.min(state.minValue, value) : value;
        state.hasValue = true;
        break;
    }
  }

  getValue(metricId: string, dimensions: readonly string[] = []): number | undefined {
    const definition = this.definitions.get(metricId);
    if (!definition) {
      return undefined;
    }

    const state = this.series.get(metricId)?.get(dimensionsToKey(dimensions));
    if (!state) {
      return undefined;
    }

    switch (definition.type) {
      case "counter":
        return state.counterSum;
      case "average":
        return state.averageCount > 0 ? state.averageSum / state.averageCount : undefined;
      case "max":
        return state.hasValue ? state.maxValue : undefined;
      case "min":
        return state.hasValue ? state.minValue : undefined;
    }
  }

  listSeries(): ReadonlyArray<{
    metricId: string;
    dimensions: readonly string[];
    value: number;
  }> {
    const result: Array<{
      metricId: string;
      dimensions: readonly string[];
      value: number;
    }> = [];

    for (const [metricId, metricSeries] of this.series) {
      for (const [dimensionKey, state] of metricSeries) {
        const dimensions = JSON.parse(dimensionKey) as string[];
        const value = this.getValue(metricId, dimensions);
        if (value !== undefined) {
          result.push({ metricId, dimensions, value });
        }
      }
    }

    return result.sort((left, right) => {
      const metricCompare = left.metricId.localeCompare(right.metricId);
      if (metricCompare !== 0) {
        return metricCompare;
      }
      return dimensionsToKey(left.dimensions).localeCompare(dimensionsToKey(right.dimensions));
    });
  }
}
