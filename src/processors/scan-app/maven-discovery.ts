import { existsSync } from "node:fs";
import path from "node:path";
import type { Repository } from "../../discovery-model/repository.js";
import type { DiscoveryModelSnapshot } from "../../discovery-model/discovery-model-snapshot.js";
import { parseMavenRepository } from "../../parsers/maven-pom-parser.js";
import { asRepository } from "./repository-from-snapshot.js";
import {
  buildModuleDiscoveryIntents,
  moduleIdForCoordinates,
  type ModuleDiscoveryInput,
} from "./module-discovery.js";

export function discoverMavenModules(repository: Repository): ModuleDiscoveryInput[] {
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

export function discoverMavenModulesFromSnapshot(snapshot: DiscoveryModelSnapshot): ModuleDiscoveryInput[] {
  return snapshot
    .listEntities("Repository")
    .flatMap((entity) => discoverMavenModules(asRepository(entity)));
}

export function buildMavenCreateIntents(snapshot: DiscoveryModelSnapshot) {
  return buildModuleDiscoveryIntents(discoverMavenModulesFromSnapshot(snapshot));
}
