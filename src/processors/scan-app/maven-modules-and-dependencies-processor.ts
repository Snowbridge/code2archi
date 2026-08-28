import { existsSync } from "node:fs";
import path from "node:path";
import type { ProcessorId } from "../../platform/processors/processor-id.js";
import { AbstractProcessor } from "../../platform/processors/processor.js";
import type { ScanAppInput, ScanAppOutput } from "../../platform/processors/scan-app-types.js";
import type { Repository } from "../../discovery-model/repository.js";
import { parseMavenRepository } from "../../parsers/maven-pom-parser.js";
import {
  asRepositoryFromSnapshot,
  buildModuleDiscoveryIntents,
  moduleIdForCoordinates,
  type ModuleDiscoveryInput,
} from "./module-discovery.js";

export class MavenModulesAndDependenciesProcessor extends AbstractProcessor<
  ScanAppInput,
  ScanAppOutput
> {
  readonly id: ProcessorId = {
    groupId: "scan-app",
    artifactId: "maven-modules-and-dependencies",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers Maven modules and their dependencies in repositories whose buildSystems include maven.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const modules = input
      .listEntities("Repository")
      .flatMap((entity) => this.discoverModules(asRepositoryFromSnapshot(entity)));
    return buildModuleDiscoveryIntents(modules);
  }

  private discoverModules(repository: Repository): ModuleDiscoveryInput[] {
    if (!repository.buildSystems.includes("maven")) {
      return [];
    }

    const rootPom = path.join(repository.localPath, "pom.xml");
    if (!existsSync(rootPom)) {
      return [];
    }

    const parsedModules = parseMavenRepository(repository.localPath, "pom.xml");
    return parsedModules.map((module) => ({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: module.coordinates.groupId,
      artifactId: module.coordinates.artifactId,
      version: module.coordinates.version,
      repoPath: module.repoPath,
      buildScript: module.buildScript,
      isMultimodule: module.isMultimodule,
      parentModuleId: module.parentCoordinates
        ? moduleIdForCoordinates(
            repository.id,
            "maven",
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
