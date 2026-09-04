import { existsSync } from "node:fs";
import path from "node:path";
import type { ApplicationModuleRecord } from "../../discovery-model/entities/application-module.js";
import type { RepositoryRecord } from "../../discovery-model/entities/repository.js";
import { UNKNOWN_VERSION } from "../build-tool-versions.js";
import {
  hasAnyNodejsRestFrameworkInPackageTree,
  hasNpmToolchainInPackageTree,
} from "./package-json-framework-deps.js";
import {
  resolveIncludeDirectories,
  resolveNextJsAppDirectory,
  resolveTsconfig,
  shouldExcludePath,
} from "./tsconfig-resolver.js";

export function isEligibleNpmModule(
  module: ApplicationModuleRecord,
  repository?: RepositoryRecord,
): boolean {
  if (module.buildSystem !== "npm") {
    return false;
  }

  if (
    module.nodeVersion !== UNKNOWN_VERSION ||
    module.typescriptVersion !== UNKNOWN_VERSION ||
    module.tsxVersion !== UNKNOWN_VERSION
  ) {
    return true;
  }

  if (repository === undefined) {
    return false;
  }

  const packageRoot = resolveNpmPackageRoot(repository, module);
  if (hasNpmToolchainInPackageTree(packageRoot, repository.localPath)) {
    return true;
  }

  return hasAnyNodejsRestFrameworkInPackageTree(packageRoot, repository.localPath);
}

export function resolveNpmPackageRoot(
  repository: RepositoryRecord,
  module: ApplicationModuleRecord,
): string {
  return path.join(repository.localPath, module.repoPath);
}

export function resolveNpmProductionSourceRoots(
  repository: RepositoryRecord,
  module: ApplicationModuleRecord,
): string[] {
  const packageRoot = resolveNpmPackageRoot(repository, module);
  const tsconfig = resolveTsconfig(packageRoot);
  const includeDirectories = resolveIncludeDirectories(packageRoot, tsconfig);

  const roots = new Set<string>();
  for (const directory of includeDirectories) {
    if (existsSync(directory)) {
      roots.add(directory);
    }
  }

  if (roots.size === 0 && existsSync(packageRoot)) {
    roots.add(packageRoot);
  }

  return [...roots].sort();
}

export function resolveNpmNextJsAppRoot(
  repository: RepositoryRecord,
  module: ApplicationModuleRecord,
): string | undefined {
  const appDirectory = resolveNextJsAppDirectory(
    resolveNpmPackageRoot(repository, module),
  );
  return existsSync(appDirectory) ? appDirectory : undefined;
}

export function isExcludedNpmSourceFile(absolutePath: string, packageRoot: string): boolean {
  const tsconfig = resolveTsconfig(packageRoot);
  return shouldExcludePath(absolutePath, tsconfig);
}

export function toRepositoryRelativePath(
  repository: RepositoryRecord,
  absolutePath: string,
): string {
  return path.relative(repository.localPath, absolutePath).replace(/\\/g, "/");
}

export function buildQualifiedSymbol(relativeSourceFile: string, exportName: string): string {
  return `${relativeSourceFile}#${exportName}`;
}
