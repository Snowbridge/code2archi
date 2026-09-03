import { existsSync } from "node:fs";
import path from "node:path";
import {
  AbstractProcessor,
  type ProcessorId,
  type ScanAppInput,
  type ScanAppOutput,
} from "../../../../../platform/processors/processor.js";
import type { RepositoryRecord } from "../../../../../discovery-model/entities/repository.js";
import { parseMavenRepository } from "../../../../../parsers/maven-pom-parser.js";
import {
  asRepositoryFromSnapshot,
  buildModuleDiscoveryIntents,
  moduleIdForCoordinates,
  type ModuleDiscoveryInput,
} from "../../module-discovery.js";

export class ModulesAndDependenciesProcessor extends AbstractProcessor<
  ScanAppInput,
  ScanAppOutput
> {
  readonly id: ProcessorId = {
    groupId: "scan.source.assembly.maven",
    artifactId: "modules-and-dependencies",
  };

  readonly version = "0.4.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Discovers Maven modules and their dependencies in repositories whose buildSystems include maven.";

  protected doProcess(input: ScanAppInput): ScanAppOutput {
    const modules = input
      .listEntities("Repository")
      .flatMap((entity) => this.discoverModules(asRepositoryFromSnapshot(entity)));
    return buildModuleDiscoveryIntents(modules);
  }

  private discoverModules(repository: RepositoryRecord): ModuleDiscoveryInput[] {
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
      name: module.coordinates.artifactId,
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
      buildToolVersion: module.buildToolVersion,
      javaVersion: module.javaVersion,
      kotlinJvmTarget: module.kotlinJvmTarget,
      kotlinCompilerVersion: module.kotlinCompilerVersion,
      nodeVersion: module.nodeVersion,
    }));
  }
}
