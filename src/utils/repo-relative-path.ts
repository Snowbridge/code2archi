import path from "node:path";

export function toRepoRelativePath(repoRoot: string, absolutePath: string): string {
  const relative = path.relative(repoRoot, absolutePath);
  if (relative === "") {
    return ".";
  }

  return relative.split(path.sep).join("/");
}

export function joinRepoPath(repoPath: string, segment: string): string {
  if (repoPath === "." || repoPath === "") {
    return segment;
  }

  return `${repoPath}/${segment}`;
}

export function posixDirname(filePath: string): string {
  const index = filePath.lastIndexOf("/");
  if (index <= 0) {
    return ".";
  }

  return filePath.slice(0, index);
}
