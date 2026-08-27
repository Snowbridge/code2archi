import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Repository } from "../../discovery-model/repository.js";
import type { IProcessor } from "../../platform/processors/processor.js";
import type { ProcessorId } from "../../platform/processors/processor-id.js";
import type {
  ScanScopeInput,
  ScanScopeOutput,
} from "../../platform/processors/scan-scope-types.js";
import { createEntityId } from "../../utils/discovery-model-entities.js";
import { GitWorkingCopy } from "../../utils/git-working-copy.js";

const BUILD_SYSTEM_ORDER = ["maven", "gradle", "npm"] as const;

const BUILD_SYSTEM_FILES: Record<string, (typeof BUILD_SYSTEM_ORDER)[number]> = {
  "pom.xml": "maven",
  "build.gradle": "gradle",
  "build.gradle.kts": "gradle",
  "package.json": "npm",
};

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

function computeRepositoryNamespace(
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

function detectBuildSystems(repoRoot: string): string[] {
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

function buildRepositoryFromRoot(
  sourceDirs: readonly string[],
  repoRoot: string,
): Repository {
  const localPath = path.resolve(repoRoot);
  const url = GitWorkingCopy.resolveRemoteUrl(localPath);

  return {
    id: createEntityId([url, localPath]),
    name: path.basename(localPath),
    namespace: computeRepositoryNamespace(sourceDirs, localPath),
    localPath,
    url,
    buildSystems: detectBuildSystems(localPath),
  };
}

function buildRepositoriesFromSourceDirs(
  sourceDirs: readonly string[],
): Repository[] {
  const repoRoots = GitWorkingCopy.findRepoRootsInSourceDirs(sourceDirs);
  return repoRoots.map((repoRoot) => buildRepositoryFromRoot(sourceDirs, repoRoot));
}

export class GitReposProcessor implements IProcessor<ScanScopeInput, ScanScopeOutput> {
  readonly id: ProcessorId = {
    groupId: "scan-scope",
    artifactId: "git-repos",
  };

  readonly version = "0.2.0";

  process(input: ScanScopeInput): ScanScopeOutput {
    return buildRepositoriesFromSourceDirs(input);
  }
}
