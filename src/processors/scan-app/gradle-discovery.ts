import type { Repository } from "../../discovery-model/repository.js";
import type { DiscoveryModelSnapshot } from "../../discovery-model/discovery-model-snapshot.js";
import { parseGradleRepository } from "../../parsers/gradle-build-parser.js";
import { asRepository } from "./repository-from-snapshot.js";
import {
  buildModuleDiscoveryIntents,
  moduleIdForCoordinates,
  type ModuleDiscoveryInput,
} from "./module-discovery.js";

export function discoverGradleModules(repository: Repository): ModuleDiscoveryInput[] {
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

export function discoverGradleModulesFromSnapshot(snapshot: DiscoveryModelSnapshot): ModuleDiscoveryInput[] {
  return snapshot
    .listEntities("Repository")
    .flatMap((entity) => discoverGradleModules(asRepository(entity)));
}

export function buildGradleCreateIntents(snapshot: DiscoveryModelSnapshot) {
  return buildModuleDiscoveryIntents(discoverGradleModulesFromSnapshot(snapshot));
}
