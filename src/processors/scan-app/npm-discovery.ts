import { existsSync } from "node:fs";
import path from "node:path";
import type { Repository } from "../../discovery-model/repository.js";
import type { DiscoveryModelSnapshot } from "../../discovery-model/discovery-model-snapshot.js";
import { parseNpmRepository } from "../../parsers/package-json-parser.js";
import { asRepository } from "./repository-from-snapshot.js";
import {
  buildModuleDiscoveryIntents,
  moduleIdForCoordinates,
  npmDependencyParts,
  type ModuleDiscoveryInput,
} from "./module-discovery.js";

export function discoverNpmModules(repository: Repository): ModuleDiscoveryInput[] {
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

export function discoverNpmModulesFromSnapshot(snapshot: DiscoveryModelSnapshot): ModuleDiscoveryInput[] {
  return snapshot
    .listEntities("Repository")
    .flatMap((entity) => discoverNpmModules(asRepository(entity)));
}

export function buildNpmCreateIntents(snapshot: DiscoveryModelSnapshot) {
  return buildModuleDiscoveryIntents(discoverNpmModulesFromSnapshot(snapshot));
}
