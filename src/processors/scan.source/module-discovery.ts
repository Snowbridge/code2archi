import {
  ApplicationModule,
  type ApplicationModuleNaturalKeys,
} from "../../discovery-model/entities/application-module.js";
import { ApplicationModuleDependency } from "../../discovery-model/entities/application-module-dependency.js";
import type { CreateIntents } from "../../discovery-model/entities/create-intents.js";
import type { DiscoveryEntityRecord } from "../../discovery-model/entities/entity-types.js";
import type { RepositoryRecord } from "../../discovery-model/entities/repository.js";
import { parseNpmName } from "../../parsers/npm-name.js";

export function asRepositoryFromSnapshot(entity: DiscoveryEntityRecord): RepositoryRecord {
  return entity as unknown as RepositoryRecord;
}

export type ModuleDiscoveryInput = Omit<
  ApplicationModuleNaturalKeys,
  "parentId"
> & {
  readonly parentModuleId?: string;
  readonly dependencies: readonly {
    readonly groupId: string;
    readonly artifactId: string;
    readonly version: string;
  }[];
};

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
  const applicationModules: ApplicationModule[] = [];
  const applicationModuleDependencies: ApplicationModuleDependency[] = [];
  const seenApplicationModuleDependencies = new Set<string>();

  for (const module of modules) {
    const applicationModule = new ApplicationModule({
      repositoryId: module.repositoryId,
      buildSystem: module.buildSystem,
      groupId: module.groupId,
      artifactId: module.artifactId,
      version: module.version,
      name: module.name,
      repoPath: module.repoPath,
      buildScript: module.buildScript,
      isMultimodule: module.isMultimodule,
      buildToolVersion: module.buildToolVersion,
      javaVersion: module.javaVersion,
      kotlinJvmTarget: module.kotlinJvmTarget,
      kotlinCompilerVersion: module.kotlinCompilerVersion,
      nodeVersion: module.nodeVersion,
      ...(module.parentModuleId ? { parentId: module.parentModuleId } : {}),
    });

    applicationModules.push(applicationModule);
    const moduleId = applicationModule.id;

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

      applicationModuleDependencies.push(
        new ApplicationModuleDependency({
          parentId: moduleId,
          groupId: dependency.groupId,
          artifactId: dependency.artifactId,
          version: dependency.version,
        }),
      );
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
  buildSystem: ApplicationModuleNaturalKeys["buildSystem"],
  groupId: string,
  artifactId: string,
): string {
  return ApplicationModule.idForCoordinates(
    repositoryId,
    buildSystem,
    groupId,
    artifactId,
  );
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
