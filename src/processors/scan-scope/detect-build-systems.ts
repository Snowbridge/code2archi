import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const BUILD_SYSTEM_ORDER = ["maven", "gradle", "npm"] as const;

const BUILD_SYSTEM_FILES: Record<string, (typeof BUILD_SYSTEM_ORDER)[number]> = {
  "pom.xml": "maven",
  "build.gradle": "gradle",
  "build.gradle.kts": "gradle",
  "package.json": "npm",
};

export function detectBuildSystems(repoRoot: string): string[] {
  const resolvedRoot = path.resolve(repoRoot);
  let entries: string[];

  try {
    entries = readdirSync(resolvedRoot);
  } catch {
    throw new Error(`Failed to read repository directory: ${resolvedRoot}`);
  }

  const found = new Set<string>();
  for (const entry of entries) {
    const buildSystem = BUILD_SYSTEM_FILES[entry];
    if (buildSystem && existsSync(path.join(resolvedRoot, entry))) {
      found.add(buildSystem);
    }
  }

  return BUILD_SYSTEM_ORDER.filter((system) => found.has(system));
}
