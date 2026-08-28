import type { ApplicationModuleCreateIntent } from "../../discovery-model/entities/application-module.js";
import type { ApplicationModuleDependencyCreateIntent } from "../../discovery-model/entities/application-module-dependency.js";
import type { BuildSystem } from "../../discovery-model/entities/application-module.js";
import type { CreateIntents } from "../../discovery-model/entities/create-intents.js";
import type { DiscoveryEntityRecord } from "../../discovery-model/entities/entity-types.js";
import type { Repository } from "../../discovery-model/entities/repository.js";
import { createEntityId } from "../../utils/discovery-model-entities.js";
import { parseNpmName } from "../../parsers/npm-name.js";

export function asRepositoryFromSnapshot(entity: DiscoveryEntityRecord): Repository {
  return entity as unknown as Repository;
}

export interface ModuleDiscoveryInput {
  readonly repositoryId: string;
  readonly buildSystem: BuildSystem;
  readonly groupId: string;
  readonly artifactId: string;
  readonly version: string;
  readonly repoPath: string;
  readonly buildScript: string;
  readonly isMultimodule: boolean;
  readonly parentModuleId?: string;
  readonly dependencies: readonly {
    readonly groupId: string;
    readonly artifactId: string;
    readonly version: string;
  }[];
}

function applicationModuleDependencyIdentityKey(
  parentId: string,
  groupId: string,
  artifactId: string,
  version: string,
): string {
  return `${parentId}\u0001${groupId}\u0001${artifactId}\u0001${version}`;
}

export function buildModuleDiscoveryIntents(
  modules: readonly ModuleDiscoveryInput[],
): CreateIntents {
  const applicationModules: ApplicationModuleCreateIntent[] = [];
  const applicationModuleDependencies: ApplicationModuleDependencyCreateIntent[] = [];
  const seenApplicationModuleDependencies = new Set<string>();

  for (const module of modules) {
    const moduleId = createEntityId([
      module.repositoryId,
      module.buildSystem,
      module.groupId,
      module.artifactId,
    ]);

    applicationModules.push({
      id: moduleId,
      repositoryId: module.repositoryId,
      buildSystem: module.buildSystem,
      groupId: module.groupId,
      artifactId: module.artifactId,
      version: module.version,
      name: module.artifactId,
      repoPath: module.repoPath,
      buildScript: module.buildScript,
      isMultimodule: module.isMultimodule,
      ...(module.parentModuleId ? { parentId: module.parentModuleId } : {}),
    });

    for (const dependency of module.dependencies) {
      const identityKey = applicationModuleDependencyIdentityKey(
        moduleId,
        dependency.groupId,
        dependency.artifactId,
        dependency.version,
      );
      if (seenApplicationModuleDependencies.has(identityKey)) {
        continue;
      }
      seenApplicationModuleDependencies.add(identityKey);

      applicationModuleDependencies.push({
        id: createEntityId([moduleId, dependency.groupId, dependency.artifactId, dependency.version]),
        parentId: moduleId,
        groupId: dependency.groupId,
        artifactId: dependency.artifactId,
        version: dependency.version,
      });
    }
  }

  return {
    entities: {
      ApplicationModule: applicationModules,
      ApplicationModuleDependency: applicationModuleDependencies,
    },
  };
}

export function moduleIdForCoordinates(
  repositoryId: string,
  buildSystem: BuildSystem,
  groupId: string,
  artifactId: string,
): string {
  return createEntityId([repositoryId, buildSystem, groupId, artifactId]);
}

export function npmDependencyParts(name: string, version: string): {
  readonly groupId: string;
  readonly artifactId: string;
  readonly version: string;
} {
  const parts = parseNpmName(name);
  return {
    groupId: parts.groupId,
    artifactId: parts.artifactId,
    version,
  };
}
