import { readFileSync } from "node:fs";
import type { ScanAppInput } from "../../../../../platform/processors/processor.js";
import type { ApplicationModuleRecord } from "../../../../../discovery-model/entities/application-module.js";
import type { RepositoryRecord } from "../../../../../discovery-model/entities/repository.js";
import { hasFrameworkPackage } from "../../../../../parsers/nodejs/package-json-framework-deps.js";
import type { NodejsFrameworkPackage } from "../../../../../parsers/nodejs/package-json-framework-deps.js";
import {
  isEligibleNpmModule,
  resolveNpmPackageRoot,
  resolveNpmProductionSourceRoots,
} from "../../../../../parsers/nodejs/nodejs-source-roots.js";
import type { NpmModuleSourceContext } from "../../../../../parsers/nodejs/nodejs-module-scan.js";
import { forEachRepository } from "../../../../../platform/cli-progress/index.js";

export function buildNpmModuleContexts(
  input: ScanAppInput,
  repository: RepositoryRecord,
  requiredFrameworks: readonly NodejsFrameworkPackage[],
): NpmModuleSourceContext[] {
  const contexts: NpmModuleSourceContext[] = [];

  for (const entity of input.listEntities("ApplicationModule")) {
    const module = entity as unknown as ApplicationModuleRecord;
    if (!isEligibleNpmModule(module, repository) || module.repositoryId !== repository.id) {
      continue;
    }

    const packageRoot = resolveNpmPackageRoot(repository, module);
    const hasRequiredFramework = requiredFrameworks.some((framework) =>
      hasFrameworkPackage(packageRoot, framework, repository.localPath),
    );

    if (!hasRequiredFramework) {
      continue;
    }

    const sourceRoots = resolveNpmProductionSourceRoots(repository, module);
    if (sourceRoots.length === 0) {
      continue;
    }

    contexts.push({
      module,
      repository,
      sourceRoots,
      packageRoot,
    });
  }

  return contexts;
}

export function forEachNpmRepository(
  input: ScanAppInput,
  visitor: (repository: RepositoryRecord) => void,
): void {
  forEachRepository(input, visitor);
}

export function readSourceFile(absolutePath: string): string {
  return readFileSync(absolutePath, "utf8");
}
