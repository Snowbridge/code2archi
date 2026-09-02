export function dimensionsToKey(dimensions: readonly string[]): string {
  return JSON.stringify(dimensions);
}

export function formatMetricKey(
  metricId: string,
  labelNames: readonly string[] | undefined,
  dimensions: readonly string[],
): string {
  if (!labelNames || labelNames.length === 0) {
    return metricId;
  }

  if (dimensions.length !== labelNames.length) {
    throw new Error(
      `Metric ${metricId} expects ${labelNames.length} dimension(s), got ${dimensions.length}`,
    );
  }

  const labels = labelNames
    .map((name, index) => ({ name, value: dimensions[index] ?? "" }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const labelPart = labels
    .map(({ name, value }) => `${name}=${JSON.stringify(value)}`)
    .join(",");

  return `${metricId}{${labelPart}}`;
}
