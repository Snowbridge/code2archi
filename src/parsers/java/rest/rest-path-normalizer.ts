export function normalizePathSegment(segment: string): string {
  let normalized = segment.trim();
  if (!normalized) {
    return "";
  }

  normalized = normalized.replace(/\{([^}]+)\}/g, ":$1");
  normalized = normalized.replace(/\/+/g, "/");
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function joinPaths(classPath: string, methodPath: string): string {
  const left = classPath.trim();
  const right = methodPath.trim();

  if (!left && !right) {
    return "/";
  }

  if (!left) {
    return normalizePathSegment(right);
  }

  if (!right) {
    return normalizePathSegment(left);
  }

  const joined = `${left.replace(/\/$/, "")}/${right.replace(/^\//, "")}`;
  return normalizePathSegment(joined);
}

export function formatEndpoint(httpMethod: string, path: string): string {
  return `${httpMethod} ${normalizePathSegment(path)}`;
}
