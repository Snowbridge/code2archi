import type { ApplicationModuleRecord } from "../discovery-model/entities/application-module.js";
import type { RepositoryRecord } from "../discovery-model/entities/repository.js";
import { listScanSourceFiles, readScanUtf8File } from "../platform/scan-io/index.js";
import { UNKNOWN_VERSION } from "./build-tool-versions.js";
import {
  parseGradleProductionJavaSourceRoots,
  parseGradleProductionKotlinSourceRoots,
  resolveMavenProductionJavaSourceRoot,
  resolveMavenProductionKotlinSourceRoot,
} from "./gradle-source-roots.js";

export interface ModuleSourceContext {
  readonly module: ApplicationModuleRecord;
  readonly repository: RepositoryRecord;
  readonly sourceRoots: readonly string[];
}

export interface SourceFileContext {
  readonly absolutePath: string;
  readonly module: ApplicationModuleRecord;
  readonly repository: RepositoryRecord;
}

export function isEligibleJavaOrKotlinModule(module: ApplicationModuleRecord): boolean {
  return (
    (module.buildSystem === "maven" || module.buildSystem === "gradle") &&
    (module.javaVersion !== UNKNOWN_VERSION || module.kotlinJvmTarget !== UNKNOWN_VERSION)
  );
}

export function resolveJavaSourceRoots(
  repository: RepositoryRecord,
  module: ApplicationModuleRecord,
): string[] {
  if (module.buildSystem === "maven") {
    const sourceRoot = resolveMavenProductionJavaSourceRoot(repository.localPath, module.repoPath);
    return sourceRoot ? [sourceRoot] : [];
  }

  return parseGradleProductionJavaSourceRoots(
    repository.localPath,
    module.repoPath,
    module.buildScript,
  );
}

export function resolveKotlinSourceRoots(
  repository: RepositoryRecord,
  module: ApplicationModuleRecord,
): string[] {
  if (module.buildSystem === "maven") {
    const sourceRoot = resolveMavenProductionKotlinSourceRoot(repository.localPath, module.repoPath);
    return sourceRoot ? [sourceRoot] : [];
  }

  return parseGradleProductionKotlinSourceRoots(
    repository.localPath,
    module.repoPath,
    module.buildScript,
  );
}

export function collectSourceFiles(
  contexts: readonly ModuleSourceContext[],
  extension: string,
): SourceFileContext[] {
  const fileToContext = new Map<string, SourceFileContext>();

  for (const context of contexts) {
    for (const sourceRoot of context.sourceRoots) {
      for (const absolutePath of listScanSourceFiles(sourceRoot, extension)) {
        const existing = fileToContext.get(absolutePath);
        if (!existing) {
          fileToContext.set(absolutePath, {
            absolutePath,
            module: context.module,
            repository: context.repository,
          });
          continue;
        }

        if (context.module.repoPath.length > existing.module.repoPath.length) {
          fileToContext.set(absolutePath, {
            absolutePath,
            module: context.module,
            repository: context.repository,
          });
        }
      }
    }
  }

  return [...fileToContext.values()].sort((left, right) =>
    left.absolutePath.localeCompare(right.absolutePath),
  );
}

export function readSourcesByModule(
  fileContexts: readonly SourceFileContext[],
): Map<string, { context: SourceFileContext; sources: Map<string, string> }> {
  const byModule = new Map<string, { context: SourceFileContext; sources: Map<string, string> }>();

  for (const fileContext of fileContexts) {
    const moduleId = fileContext.module.id;
    let entry = byModule.get(moduleId);
    if (!entry) {
      entry = {
        context: fileContext,
        sources: new Map<string, string>(),
      };
      byModule.set(moduleId, entry);
    }

    try {
      entry.sources.set(fileContext.absolutePath, readScanUtf8File(fileContext.absolutePath));
    } catch {
      continue;
    }
  }

  return byModule;
}

export function groupSourceFilesByModule(
  fileContexts: readonly SourceFileContext[],
): Map<string, { context: SourceFileContext; paths: string[] }> {
  const byModule = new Map<string, { context: SourceFileContext; paths: string[] }>();

  for (const fileContext of fileContexts) {
    const moduleId = fileContext.module.id;
    let entry = byModule.get(moduleId);
    if (!entry) {
      entry = { context: fileContext, paths: [] };
      byModule.set(moduleId, entry);
    }
    entry.paths.push(fileContext.absolutePath);
  }

  return byModule;
}
