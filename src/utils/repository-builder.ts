import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { Repository } from "../discovery-model/entities/repository.js";

export class RepositoryBuilder {
  private static readonly BUILD_SYSTEM_ORDER = ["maven", "gradle", "npm"] as const;

  private static readonly BUILD_SYSTEM_FILES: Record<
    string,
    (typeof RepositoryBuilder.BUILD_SYSTEM_ORDER)[number]
  > = {
    "pom.xml": "maven",
    "build.gradle": "gradle",
    "build.gradle.kts": "gradle",
    "package.json": "npm",
  };

  static buildFromRoot(
    sourceDirs: readonly string[],
    repoRoot: string,
    url: string,
  ): Repository {
    const localPath = path.resolve(repoRoot);

    return new Repository({
      url,
      localPath,
      name: path.basename(localPath),
      namespace: "",
      buildSystems: RepositoryBuilder.detectBuildSystems(localPath),
    });
  }

  private static detectBuildSystems(repoRoot: string): string[] {
    const resolvedRoot = path.resolve(repoRoot);
    let entries: string[];

    try {
      entries = readdirSync(resolvedRoot);
    } catch {
      throw new Error(`Failed to read repository directory: ${resolvedRoot}`);
    }

    const found = new Set<string>();
    for (const entry of entries) {
      const buildSystem = RepositoryBuilder.BUILD_SYSTEM_FILES[entry];
      if (buildSystem && existsSync(path.join(resolvedRoot, entry))) {
        found.add(buildSystem);
      }
    }

    return RepositoryBuilder.BUILD_SYSTEM_ORDER.filter((system) => found.has(system));
  }
}
