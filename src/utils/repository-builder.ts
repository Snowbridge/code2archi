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
      namespace: RepositoryBuilder.computeNamespace(sourceDirs, localPath),
      buildSystems: RepositoryBuilder.detectBuildSystems(localPath),
    });
  }

  private static computeNamespace(
    sourceDirs: readonly string[],
    localPath: string,
  ): string {
    const resolvedLocalPath = path.resolve(localPath);
    const commonPrefix = RepositoryBuilder.findCommonPathPrefix(sourceDirs);
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

  private static findCommonPathPrefix(paths: readonly string[]): string {
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
