export function moduleArtifactRepoPathValue(
  repositoryNamespace: string,
  repositoryName: string,
  moduleRepoPath: string,
): string {
  const base = `${repositoryNamespace}/${repositoryName}`;
  if (moduleRepoPath === "") {
    return base;
  }
  return `${base}://${moduleRepoPath}`;
}
