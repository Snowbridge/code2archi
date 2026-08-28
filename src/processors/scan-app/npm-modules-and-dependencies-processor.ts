import { existsSync } from "node:fs";
import path from "node:path";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../platform/processors/processor.js";
import type { Repository } from "../../discovery-model/entities/repository.js";
import { parseNpmRepository } from "../../parsers/package-json-parser.js";
import {
  asRepositoryFromSnapshot,
  buildModuleDiscoveryIntents,
  moduleIdForCoordinates,
  npmDependencyParts,
  type ModuleDiscoveryInput,
} from "./module-discovery.js";

export class NpmModulesAndDependenciesProcessor extends AbstractProcessor<
  ScanAppInput,
  ScanAppOutput
> {
  readonly id: ProcessorId = {
    groupId: "scan-app",
    artifactId: "npm-modules-and-dependencies",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers npm modules (including workspaces) and dependencies in repositories whose buildSystems include npm.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const modules = input
      .listEntities("Repository")
      .flatMap((entity) => this.discoverModules(asRepositoryFromSnapshot(entity)));
    return buildModuleDiscoveryIntents(modules);
  }

  private discoverModules(repository: Repository): ModuleDiscoveryInput[] {
    if (!repository.buildSystems.includes("npm")) {
      return [];
    }

    const rootPackageJson = path.join(repository.localPath, "package.json");
    if (!existsSync(rootPackageJson)) {
      return [];
    }

    const parsedModules = parseNpmRepository(repository.localPath, "package.json");
    const rootModule = parsedModules[0];
    const rootModuleId = rootModule
      ? moduleIdForCoordinates(repository.id, "npm", rootModule.groupId, rootModule.artifactId)
      : undefined;

    return parsedModules.map((module) => {
      const parentName = module.parentName;
      let parentModuleId: string | undefined;
      if (parentName && rootModule && parentName === rootModule.name) {
        parentModuleId = rootModuleId;
      }

      return {
        repositoryId: repository.id,
        buildSystem: "npm" as const,
        groupId: module.groupId,
        artifactId: module.artifactId,
        version: module.version,
        repoPath: module.repoPath,
        buildScript: module.buildScript,
        isMultimodule: module.isMultimodule,
        parentModuleId,
        dependencies: Object.entries(module.dependencies).map(([name, version]) =>
          npmDependencyParts(name, version),
        ),
      };
    });
  }
}
