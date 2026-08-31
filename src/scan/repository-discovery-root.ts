import path from "node:path";

function findCommonPathPrefix(paths: readonly string[]): string {
  if (paths.length === 0) {
    return "";
  }

  let prefix = path.resolve(paths[0]!);
  for (const localPath of paths.slice(1)) {
    const resolved = path.resolve(localPath);
    while (
      prefix !== resolved &&
      !resolved.startsWith(prefix + path.sep) &&
      prefix !== path.parse(prefix).root
    ) {
      prefix = path.dirname(prefix);
    }
    if (prefix === path.parse(prefix).root) {
      return prefix;
    }
  }

  return prefix;
}

export function computeRepositoryCommonRoot(localPaths: readonly string[]): string {
  if (localPaths.length === 0) {
    return "";
  }

  const resolvedPaths = localPaths.map((localPath) => path.resolve(localPath));
  const commonRoot = findCommonPathPrefix(resolvedPaths);
  const fsRoot = path.parse(commonRoot).root;

  if (!commonRoot || commonRoot === fsRoot) {
    return "";
  }

  return commonRoot;
}

export function computeRepositoryNamespace(commonRoot: string, localPath: string): string {
  if (!commonRoot) {
    return "";
  }

  const parentPath = path.dirname(path.resolve(localPath));
  const relative = path.relative(path.resolve(commonRoot), parentPath);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return "";
  }

  return relative.split(path.sep).join("/");
}
