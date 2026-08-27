import path from "node:path";
import type { Repository } from "../../discovery-model/repository.js";
import { computeRepositoryNamespace } from "./compute-repository-namespace.js";
import { createRepositoryId } from "./create-repository-id.js";
import { detectBuildSystems } from "./detect-build-systems.js";
import { findGitRepoRootsInSourceDirs } from "./find-git-repo-roots.js";
import { resolveGitRemoteUrl } from "./resolve-git-remote-url.js";

export function buildRepositoryFromRoot(
  sourceDirs: readonly string[],
  repoRoot: string,
): Repository {
  const localPath = path.resolve(repoRoot);
  const url = resolveGitRemoteUrl(localPath);

  return {
    id: createRepositoryId(url, localPath),
    name: path.basename(localPath),
    namespace: computeRepositoryNamespace(sourceDirs, localPath),
    localPath,
    url,
    buildSystems: detectBuildSystems(localPath),
  };
}

export function buildRepositoriesFromSourceDirs(
  sourceDirs: readonly string[],
): Repository[] {
  const repoRoots = findGitRepoRootsInSourceDirs(sourceDirs);
  return repoRoots.map((repoRoot) => buildRepositoryFromRoot(sourceDirs, repoRoot));
}
