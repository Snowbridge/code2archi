import type {
  ArchiElementRecord,
  ArchiRelationshipRecord,
} from "../../archimate-model/archi-create-intents.js";
import { computeArchiId } from "../../archimate-model/archi-id.js";
import { ApplicationComponent, Artifact } from "../../archimate-model/elements/archi-element.js";
import type { ArchiModelSnapshot } from "../../archimate-model/archi-model-store.js";
import {
  BuildScriptProfile,
  GitRepoProfile,
  GradleModuleProfile,
  LibraryModuleProfile,
  MavenModuleProfile,
  NpmModuleProfile,
  type ArchiProfile,
} from "../../archimate-model/profiles/profile.js";
import {
  AggregationRelationship,
  AssociationRelationship,
  CompositionRelationship,
  RealizationRelationship,
} from "../../archimate-model/relationships/archi-relationship.js";
import type { DiscoveryModelSnapshot } from "../../discovery-model/discovery-model-snapshot.js";
import type { ApplicationModuleDependencyRecord } from "../../discovery-model/entities/application-module-dependency.js";
import type { ApplicationModuleRecord } from "../../discovery-model/entities/application-module.js";
import type { RepositoryRecord } from "../../discovery-model/entities/repository.js";
import type { DiscoveryEntityRecord } from "../../discovery-model/entities/entity-types.js";
import { packageVersion } from "../../package-version.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type GenerateProcessorOutput,
  type ProcessorId,
} from "../../platform/processors/processor.js";

const GENERATOR = "generate.elements:code-repositories-with-modules";

type ModuleRecord = ApplicationModuleRecord & DiscoveryEntityRecord;
type DependencyRecord = ApplicationModuleDependencyRecord & DiscoveryEntityRecord;

export class CodeRepositoriesWithModulesProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  GenerateProcessorOutput
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements",
    artifactId: "code-repositories-with-modules",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Maps Repository and ApplicationModule discovery entities to Git repo, build script, and module ArchiMate elements with relations.";

  protected doProcess(input: GenerateProcessorInput): GenerateProcessorOutput {
    const { discovery, archi } = input;
    const modules = this.asModules(discovery.listEntities("ApplicationModule"));
    const dependencies = this.asDependencies(
      discovery.listEntities("ApplicationModuleDependency"),
    );
    const dependencyCoordinateKeys = this.buildDependencyCoordinateKeys(dependencies);
    const modulesByCoordinate = this.indexModulesByCoordinate(modules);
    const standaloneModules = modules.filter((module) =>
      this.isStandalone(module, dependencyCoordinateKeys),
    );
    const standaloneIds = new Set(standaloneModules.map((module) => module.id));
    const moduleById = new Map(modules.map((module) => [module.id, module]));

    const profiles = this.collectMissingProfiles(archi);
    const elements: ArchiElementRecord[] = [];
    const relations: ArchiRelationshipRecord[] = [];
    const emittedBuildScriptIds = new Set<string>();

    const technologyFolderId = archi.getPredefinedFolderId("technology");
    const applicationFolderId = archi.getPredefinedFolderId("application");
    const gitRepoProfileId = GitRepoProfile.create().id;
    const buildScriptProfileId = BuildScriptProfile.create().id;
    const libraryModuleProfileId = LibraryModuleProfile.create().id;

    for (const repository of this.asRepositories(discovery.listEntities("Repository"))) {
      const moduleCount = discovery.listEntitiesByRef(
        "ApplicationModule",
        "repositoryId",
        repository.id,
      ).length;

      elements.push(
        Artifact.withId(repository.id)
          .name(repository.name)
          .inFolder(technologyFolderId)
          .profiles(gitRepoProfileId)
          .property("c2a:modulesCount", String(moduleCount))
          .property("c2a:Id", repository.name)
          .property("c2a:confidence", "confirmed")
          .property("c2a:schema", packageVersion)
          .property("c2a:generator", GENERATOR)
          .build(),
      );
    }

    for (const module of standaloneModules) {
      const buildScriptId = this.buildScriptArtifactId(module.repositoryId, module.buildScript);
      if (!emittedBuildScriptIds.has(buildScriptId)) {
        emittedBuildScriptIds.add(buildScriptId);
        elements.push(
          Artifact.withId(buildScriptId)
            .name(module.buildScript)
            .inFolder(technologyFolderId)
            .profiles(buildScriptProfileId)
            .property("c2a:Id", module.buildScript)
            .property("c2a:confidence", "confirmed")
            .property("c2a:schema", packageVersion)
            .property("c2a:generator", GENERATOR)
            .build(),
        );
      }

      const moduleProfileId = this.profileForBuildSystem(module.buildSystem).id;
      elements.push(
        ApplicationComponent.withId(module.id)
          .name(module.name)
          .inFolder(applicationFolderId)
          .profiles(moduleProfileId)
          .property("c2a:Id", module.name)
          .property("c2a:confidence", "confirmed")
          .property("c2a:schema", packageVersion)
          .property("c2a:generator", GENERATOR)
          .build(),
      );

      const compositionId = computeArchiId("Composition", module.repositoryId, buildScriptId);
      const realizationId = computeArchiId("Realization", module.repositoryId, module.id);
      const associationId = computeArchiId("Association", buildScriptId, module.id);

      relations.push(
        CompositionRelationship.withId(compositionId)
          .source(module.repositoryId)
          .target(buildScriptId)
          .property("c2a:Id", compositionId)
          .property("c2a:confidence", "confirmed")
          .property("c2a:schema", packageVersion)
          .property("c2a:generator", GENERATOR)
          .build(),
        RealizationRelationship.withId(realizationId)
          .source(module.repositoryId)
          .target(module.id)
          .property("c2a:Id", realizationId)
          .property("c2a:confidence", "confirmed")
          .property("c2a:schema", packageVersion)
          .property("c2a:generator", GENERATOR)
          .build(),
        AssociationRelationship.withId(associationId)
          .source(buildScriptId)
          .target(module.id)
          .property("c2a:Id", associationId)
          .property("c2a:confidence", "confirmed")
          .property("c2a:schema", packageVersion)
          .property("c2a:generator", GENERATOR)
          .build(),
      );
    }

    for (const module of modules) {
      if (this.isStandalone(module, dependencyCoordinateKeys)) {
        continue;
      }

      elements.push(
        ApplicationComponent.withId(module.id)
          .name(module.name)
          .inFolder(applicationFolderId)
          .profiles(libraryModuleProfileId)
          .property("c2a:Id", module.name)
          .property("c2a:confidence", "confirmed")
          .property("c2a:schema", packageVersion)
          .property("c2a:generator", GENERATOR)
          .build(),
      );
    }

    for (const dependency of dependencies) {
      if (!standaloneIds.has(dependency.parentId)) {
        continue;
      }

      const parentModule = moduleById.get(dependency.parentId);
      if (!parentModule) {
        continue;
      }

      const libraryModule = this.resolveLibraryModule(
        dependency,
        modulesByCoordinate,
        parentModule,
      );
      if (!libraryModule) {
        continue;
      }

      const aggregationId = computeArchiId(
        "Aggregation",
        dependency.parentId,
        libraryModule.id,
        dependency.version,
      );
      relations.push(
        AggregationRelationship.withId(aggregationId)
          .source(dependency.parentId)
          .target(libraryModule.id)
          .property("version", dependency.version)
          .property("c2a:Id", aggregationId)
          .property("c2a:confidence", "confirmed")
          .property("c2a:schema", packageVersion)
          .property("c2a:generator", GENERATOR)
          .build(),
      );
    }

    return {
      ...(profiles.length > 0 ? { profiles } : {}),
      ...(elements.length > 0 ? { elements } : {}),
      ...(relations.length > 0 ? { relations } : {}),
    };
  }

  private asRepositories(entities: readonly DiscoveryEntityRecord[]): readonly RepositoryRecord[] {
    return entities as unknown as RepositoryRecord[];
  }

  private asModules(entities: readonly DiscoveryEntityRecord[]): readonly ModuleRecord[] {
    return entities as unknown as ModuleRecord[];
  }

  private asDependencies(entities: readonly DiscoveryEntityRecord[]): readonly DependencyRecord[] {
    return entities as unknown as DependencyRecord[];
  }

  private buildDependencyCoordinateKeys(dependencies: readonly DependencyRecord[]): Set<string> {
    const keys = new Set<string>();
    for (const dependency of dependencies) {
      keys.add(this.coordinateKey(dependency.groupId, dependency.artifactId));
    }
    return keys;
  }

  private indexModulesByCoordinate(
    modules: readonly ModuleRecord[],
  ): Map<string, ModuleRecord[]> {
    const index = new Map<string, ModuleRecord[]>();
    for (const module of modules) {
      const key = this.coordinateKey(module.groupId, module.artifactId);
      const bucket = index.get(key);
      if (bucket) {
        bucket.push(module);
      } else {
        index.set(key, [module]);
      }
    }
    return index;
  }

  private isStandalone(module: ModuleRecord, dependencyCoordinateKeys: ReadonlySet<string>): boolean {
    return !dependencyCoordinateKeys.has(this.coordinateKey(module.groupId, module.artifactId));
  }

  private coordinateKey(groupId: string, artifactId: string): string {
    return `${groupId}\u0001${artifactId}`;
  }

  private buildScriptArtifactId(repositoryId: string, buildScript: string): string {
    return computeArchiId("BuildScript", repositoryId, buildScript);
  }

  private profileForBuildSystem(buildSystem: ModuleRecord["buildSystem"]): ArchiProfile {
    switch (buildSystem) {
      case "npm":
        return NpmModuleProfile.create();
      case "maven":
        return MavenModuleProfile.create();
      case "gradle":
        return GradleModuleProfile.create();
      default:
        throw new Error(`Unsupported buildSystem for module profile: ${String(buildSystem)}`);
    }
  }

  private resolveLibraryModule(
    dependency: DependencyRecord,
    modulesByCoordinate: ReadonlyMap<string, ModuleRecord[]>,
    parentModule: ModuleRecord,
  ): ModuleRecord | undefined {
    const candidates = modulesByCoordinate.get(
      this.coordinateKey(dependency.groupId, dependency.artifactId),
    );
    if (!candidates || candidates.length === 0) {
      return undefined;
    }
    if (candidates.length === 1) {
      return candidates[0];
    }

    const sameRepository = candidates.filter(
      (candidate) => candidate.repositoryId === parentModule.repositoryId,
    );
    const pool = sameRepository.length > 0 ? sameRepository : candidates;
    return [...pool].sort((left, right) => left.id.localeCompare(right.id))[0];
  }

  private collectMissingProfiles(archi: ArchiModelSnapshot): ArchiProfile[] {
    const profiles: ArchiProfile[] = [];
    const candidates: readonly { readonly name: string; readonly factory: () => ArchiProfile }[] =
      [
        { name: "Git repo", factory: () => GitRepoProfile.create() },
        { name: "Build script", factory: () => BuildScriptProfile.create() },
        { name: "NPM module", factory: () => NpmModuleProfile.create() },
        { name: "Maven module", factory: () => MavenModuleProfile.create() },
        { name: "Gradle module", factory: () => GradleModuleProfile.create() },
        { name: "Library module", factory: () => LibraryModuleProfile.create() },
      ];

    for (const candidate of candidates) {
      const profile = candidate.factory();
      if (!archi.findProfile(candidate.name, profile.conceptType)) {
        profiles.push(profile);
      }
    }

    return profiles;
  }
}
