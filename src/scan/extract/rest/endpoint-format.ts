export function formatHttpEndpoint(method: string, pathTemplate: string): string {
  const normalizedMethod = method.trim().toUpperCase();
  let normalizedPath = pathTemplate.trim();
  if (!normalizedPath.startsWith("/")) {
    normalizedPath = `/${normalizedPath}`;
  }
  normalizedPath = normalizedPath.replaceAll("//", "/");
  return `${normalizedMethod} ${normalizedPath}`;
}

export function joinPathPrefixes(classPrefix: string, methodPrefix: string): string {
  const left = classPrefix.trim().replace(/\/$/, "");
  const right = methodPrefix.trim().replace(/^\//, "");
  if (left.length === 0) {
    return right.length === 0 ? "/" : `/${right}`;
  }
  if (right.length === 0) {
    return left.startsWith("/") ? left : `/${left}`;
  }
  const combined = `${left}/${right}`.replaceAll("//", "/");
  return combined.startsWith("/") ? combined : `/${combined}`;
}
