import { existsSync } from "node:fs";
import path from "node:path";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../platform/processors/processor.js";
import type { Repository } from "../../discovery-model/entities/repository.js";
import { parseGradleRepository } from "../../parsers/gradle-build-parser.js";
import {
  asRepositoryFromSnapshot,
  buildModuleDiscoveryIntents,
  moduleIdForCoordinates,
  type ModuleDiscoveryInput,
} from "./module-discovery.js";

export class GradleModulesAndDependenciesProcessor extends AbstractProcessor<
  ScanAppInput,
  ScanAppOutput
> {
  readonly id: ProcessorId = {
    groupId: "scan-app",
    artifactId: "gradle-modules-and-dependencies",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers Gradle modules and implementation dependencies in repositories whose buildSystems include gradle.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const modules = input
      .listEntities("Repository")
      .flatMap((entity) => this.discoverModules(asRepositoryFromSnapshot(entity)));
    return buildModuleDiscoveryIntents(modules);
  }

  private discoverModules(repository: Repository): ModuleDiscoveryInput[] {
    if (!repository.buildSystems.includes("gradle")) {
      return [];
    }

    const parsedModules = parseGradleRepository(repository.localPath);
    return parsedModules.map((module) => ({
      repositoryId: repository.id,
      buildSystem: "gradle",
      groupId: module.coordinates.groupId,
      artifactId: module.coordinates.artifactId,
      version: module.coordinates.version,
      repoPath: module.repoPath,
      buildScript: module.buildScript,
      isMultimodule: module.isMultimodule,
      parentModuleId: module.parentCoordinates
        ? moduleIdForCoordinates(
            repository.id,
            "gradle",
            module.parentCoordinates.groupId,
            module.parentCoordinates.artifactId,
          )
        : undefined,
      dependencies: module.dependencies.map((dependency) => ({
        groupId: dependency.groupId,
        artifactId: dependency.artifactId,
        version: dependency.version,
      })),
    }));
  }
}
