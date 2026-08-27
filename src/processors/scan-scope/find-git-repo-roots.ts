import { readdirSync, statSync } from "node:fs";
import path from "node:path";

function hasGitDirectory(dir: string): boolean {
  const gitPath = path.join(dir, ".git");
  try {
    return statSync(gitPath).isDirectory();
  } catch {
    return false;
  }
}

export function findGitRepoRoots(sourceDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    if (hasGitDirectory(dir)) {
      results.push(path.resolve(dir));
      return;
    }
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      throw new Error(`Failed to read directory: ${dir}`);
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        continue;
      }
      if (entry.name === ".git") {
        continue;
      }
      walk(path.join(dir, entry.name));
    }
  }

  walk(path.resolve(sourceDir));
  return results;
}

export function findGitRepoRootsInSourceDirs(sourceDirs: readonly string[]): string[] {
  const repoRoots = new Set<string>();
  for (const sourceDir of sourceDirs) {
    for (const repoRoot of findGitRepoRoots(sourceDir)) {
      repoRoots.add(repoRoot);
    }
  }
  return [...repoRoots];
}
