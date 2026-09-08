import path from "node:path";
import type { ApplicationModuleRecord } from "../../../code-inventory/entities/application-module.js";

export function bindApplicationModule(
  modules: readonly ApplicationModuleRecord[],
  repositoryId: string,
  fileNameRelativeToRepo: string,
): ApplicationModuleRecord | undefined {
  const normalizedFile = fileNameRelativeToRepo.replaceAll("\\", "/");
  const candidates = modules
    .filter(
      (module) =>
        module.repositoryId === repositoryId &&
        (module.buildSystem === "maven" || module.buildSystem === "gradle") &&
        normalizedFile.startsWith(`${module.repoPath.replaceAll("\\", "/")}/src/main/`),
    )
    .sort((left, right) => right.repoPath.length - left.repoPath.length);

  return candidates[0];
}

export function moduleProductionRoot(
  repositoryLocalPath: string,
  module: ApplicationModuleRecord,
): string {
  return path.join(repositoryLocalPath, module.repoPath, "src", "main");
}
