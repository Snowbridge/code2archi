import { computeArchiId } from "../archimate-model/archi-id.js";
import type { ArchiProfile } from "../archimate-model/profiles/profile.js";
import {
  GradleModuleProfile,
  LibraryModuleProfile,
  MavenModuleProfile,
  NpmModuleProfile,
} from "../archimate-model/profiles/profile.js";
import type {
  ApplicationModuleRecord,
  BuildSystem,
} from "../discovery-model/entities/application-module.js";
import type { ApplicationModuleDependencyRecord } from "../discovery-model/entities/application-module-dependency.js";

export const APPLICATION_MODULE_COMPONENT_ID_PREFIX = "appmodule:";

export type ModulesByRepositoryAndCoordinates = ReadonlyMap<
  string,
  ReadonlyMap<string, ApplicationModuleRecord>
>;

export function applicationComponentIdForModule(moduleId: string): string {
  return computeArchiId(
    "ApplicationComponent",
    `${APPLICATION_MODULE_COMPONENT_ID_PREFIX}${moduleId}`,
  );
}

export function applicationComponentLogicalId(moduleId: string): string {
  return `${APPLICATION_MODULE_COMPONENT_ID_PREFIX}${moduleId}`;
}

export function moduleCoordinateKey(groupId: string, artifactId: string): string {
  return `${groupId}\u0000${artifactId}`;
}

export function moduleApplicationComponentProfileFor(
  buildSystem: BuildSystem,
): ArchiProfile {
  switch (buildSystem) {
    case "maven":
      return MavenModuleProfile.create();
    case "gradle":
      return GradleModuleProfile.create();
    case "npm":
      return NpmModuleProfile.create();
  }
}

export function buildModulesByRepositoryAndCoordinates(
  modules: readonly ApplicationModuleRecord[],
): ModulesByRepositoryAndCoordinates {
  const byRepository = new Map<string, Map<string, ApplicationModuleRecord>>();

  for (const module of modules) {
    const coordinateKey = moduleCoordinateKey(module.groupId, module.artifactId);
    let repositoryIndex = byRepository.get(module.repositoryId);
    if (repositoryIndex === undefined) {
      repositoryIndex = new Map<string, ApplicationModuleRecord>();
      byRepository.set(module.repositoryId, repositoryIndex);
    }
    repositoryIndex.set(coordinateKey, module);
  }

  return byRepository;
}

export function resolveModuleInRepository(
  index: ModulesByRepositoryAndCoordinates,
  repositoryId: string,
  groupId: string,
  artifactId: string,
): ApplicationModuleRecord | undefined {
  return index.get(repositoryId)?.get(moduleCoordinateKey(groupId, artifactId));
}

export function collectLibraryModuleIds(
  dependencies: readonly ApplicationModuleDependencyRecord[],
  modules: readonly ApplicationModuleRecord[],
): ReadonlySet<string> {
  const modulesByCoordinate = new Map<string, ApplicationModuleRecord[]>();

  for (const module of modules) {
    const coordinateKey = moduleCoordinateKey(module.groupId, module.artifactId);
    const matches = modulesByCoordinate.get(coordinateKey);
    if (matches === undefined) {
      modulesByCoordinate.set(coordinateKey, [module]);
      continue;
    }
    matches.push(module);
  }

  const libraryModuleIds = new Set<string>();

  for (const dependency of dependencies) {
    const targetModules = modulesByCoordinate.get(
      moduleCoordinateKey(dependency.groupId, dependency.artifactId),
    );
    if (targetModules === undefined) {
      continue;
    }

    for (const targetModule of targetModules) {
      libraryModuleIds.add(targetModule.id);
    }
  }

  return libraryModuleIds;
}

export function realizationLogicalId(
  moduleArtifactId: string,
  applicationComponentId: string,
): string {
  return `realization:module-artifact:${moduleArtifactId}:${applicationComponentId}`;
}

export function realizationRelationshipId(
  moduleArtifactId: string,
  applicationComponentId: string,
): string {
  return computeArchiId(
    "RealizationRelationship",
    moduleArtifactId,
    applicationComponentId,
  );
}

export function aggregationLogicalId(dependencyId: string): string {
  return `aggregation:module-dependency:${dependencyId}`;
}

export function aggregationRelationshipId(
  consumerApplicationComponentId: string,
  libraryApplicationComponentId: string,
  dependencyId: string,
): string {
  return computeArchiId(
    "AggregationRelationship",
    consumerApplicationComponentId,
    libraryApplicationComponentId,
    dependencyId,
  );
}
