import path from "node:path";

function findCommonPathPrefix(paths: readonly string[]): string {
  if (paths.length === 0) {
    return "";
  }

  let prefix = path.resolve(paths[0]!);
  for (const dir of paths.slice(1)) {
    const resolved = path.resolve(dir);
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

export function computeRepositoryNamespace(
  sourceDirs: readonly string[],
  localPath: string,
): string {
  const resolvedLocalPath = path.resolve(localPath);
  const commonPrefix = findCommonPathPrefix(sourceDirs);
  const fsRoot = path.parse(resolvedLocalPath).root;

  if (!commonPrefix || commonPrefix === fsRoot) {
    return resolvedLocalPath;
  }

  const relative = path.relative(commonPrefix, resolvedLocalPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return resolvedLocalPath;
  }

  return `/${relative.split(path.sep).join("/")}`;
}
