import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { isJvmSourceFile, isProductionJvmSourcePath } from "./source-scope.js";

export function listProductionJvmSources(moduleProductionRoot: string): string[] {
  const results: string[] = [];
  walk(moduleProductionRoot, results);
  return results.sort((a, b) => a.localeCompare(b));
}

function walk(directory: string, results: string[]): void {
  if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) {
    return;
  }

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath, results);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!isJvmSourceFile(entry.name)) {
      continue;
    }
    if (!isProductionJvmSourcePath(absolutePath)) {
      continue;
    }
    results.push(absolutePath);
  }
}
