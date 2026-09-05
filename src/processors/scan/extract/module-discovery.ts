import {
  ApplicationModule,
  type ApplicationModuleNaturalKeys,
} from "../../../discovery-model/entities/application-module.js";
import { ApplicationModuleDependency } from "../../../discovery-model/entities/application-module-dependency.js";
import type { CreateIntents } from "../../../discovery-model/entities/create-intents.js";
import type { DiscoveryEntityRecord } from "../../../discovery-model/entities/entity-types.js";
import type { RepositoryRecord } from "../../../discovery-model/entities/repository.js";
import {
  UNKNOWN_VERSION,
} from "../../../parsers/build-tool-versions.js";
import { parseNpmName } from "../../../parsers/npm-name.js";

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

function moduleInputId(module: ModuleDiscoveryInput): string {
  return ApplicationModule.idForCoordinates(
    module.repositoryId,
    module.buildSystem,
    module.groupId,
    module.artifactId,
  );
}

function coalesceVersion(local: string | undefined, inherited: string | undefined): string {
  if (local !== undefined && local !== UNKNOWN_VERSION) {
    return local;
  }
  return inherited ?? UNKNOWN_VERSION;
}

function coalesceVersionsFromParent(
  child: ModuleDiscoveryInput,
  parent: ModuleDiscoveryInput,
): ModuleDiscoveryInput {
  return {
    ...child,
    buildToolVersion: coalesceVersion(child.buildToolVersion, parent.buildToolVersion),
    javaVersion: coalesceVersion(child.javaVersion, parent.javaVersion),
    kotlinJvmTarget: coalesceVersion(child.kotlinJvmTarget, parent.kotlinJvmTarget),
    kotlinCompilerVersion: coalesceVersion(
      child.kotlinCompilerVersion,
      parent.kotlinCompilerVersion,
    ),
    nodeVersion: coalesceVersion(child.nodeVersion, parent.nodeVersion),
    typescriptVersion: coalesceVersion(child.typescriptVersion, parent.typescriptVersion),
    tsxVersion: coalesceVersion(child.tsxVersion, parent.tsxVersion),
  };
}

export function inheritModuleVersions(
  modules: readonly ModuleDiscoveryInput[],
): ModuleDiscoveryInput[] {
  const byId = new Map(modules.map((module) => [moduleInputId(module), module]));
  const resolved = new Map<string, ModuleDiscoveryInput>();

  function resolve(id: string, visiting: Set<string> = new Set()): ModuleDiscoveryInput {
    const cached = resolved.get(id);
    if (cached) {
      return cached;
    }

    const module = byId.get(id);
    if (!module) {
      throw new Error(`Unknown ApplicationModule id during version inheritance: ${id}`);
    }

    if (visiting.has(id)) {
      throw new Error(`Cycle detected in ApplicationModule parent chain at id: ${id}`);
    }
    visiting.add(id);

    let result = module;
    if (module.parentModuleId) {
      const parent = resolve(module.parentModuleId, visiting);
      result = coalesceVersionsFromParent(module, parent);
    }

    visiting.delete(id);
    resolved.set(id, result);
    return result;
  }

  return modules.map((module) => resolve(moduleInputId(module)));
}

export function buildModuleDiscoveryIntents(
  modules: readonly ModuleDiscoveryInput[],
): CreateIntents {
  const applicationModules: ApplicationModule[] = [];
  const applicationModuleDependencies: ApplicationModuleDependency[] = [];
  const seenApplicationModuleDependencies = new Set<string>();

  for (const module of inheritModuleVersions(modules)) {
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
      typescriptVersion: module.typescriptVersion,
      tsxVersion: module.tsxVersion,
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
