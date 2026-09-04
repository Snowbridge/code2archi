export const INFRASTRUCTURE_ENDPOINT_PATTERNS = [
  "GET /",
  "GET /management/*",
  "GET /actuator/*",
] as const;

function parseEndpoint(endpoint: string): { method: string; path: string } | undefined {
  const spaceIndex = endpoint.indexOf(" ");
  if (spaceIndex <= 0) {
    return undefined;
  }

  return {
    method: endpoint.slice(0, spaceIndex),
    path: endpoint.slice(spaceIndex + 1),
  };
}

function matchesInfrastructurePattern(endpoint: string, pattern: string): boolean {
  const parsedEndpoint = parseEndpoint(endpoint);
  const parsedPattern = parseEndpoint(pattern);
  if (parsedEndpoint === undefined || parsedPattern === undefined) {
    return false;
  }

  if (parsedEndpoint.method !== parsedPattern.method) {
    return false;
  }

  if (!parsedPattern.path.includes("*")) {
    return parsedEndpoint.path === parsedPattern.path;
  }

  const wildcardIndex = parsedPattern.path.indexOf("*");
  const prefix = parsedPattern.path.slice(0, wildcardIndex);
  return parsedEndpoint.path.startsWith(prefix);
}

export function isInfrastructureEndpoint(endpoint: string): boolean {
  return INFRASTRUCTURE_ENDPOINT_PATTERNS.some((pattern) =>
    matchesInfrastructurePattern(endpoint, pattern),
  );
}

export function filterMeaningfulEndpoints(endpoints: readonly string[]): string[] {
  return [...endpoints]
    .filter((endpoint) => !isInfrastructureEndpoint(endpoint))
    .sort((left, right) => left.localeCompare(right));
}

export function hasMeaningfulEndpoints(endpoints: readonly string[]): boolean {
  return endpoints.some((endpoint) => !isInfrastructureEndpoint(endpoint));
}
