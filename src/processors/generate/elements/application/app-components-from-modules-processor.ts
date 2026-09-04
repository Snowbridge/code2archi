import type { ArchiCreateIntents } from "../../../../archimate-model/archi-create-intents.js";
import {
  ApplicationComponent,
  type ArchiElementCreateIntent,
} from "../../../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../../../archimate-model/folders/archi-folder.js";
import type { ArchiProfile } from "../../../../archimate-model/profiles/profile.js";
import {
  GradleModuleProfile,
  LibraryModuleProfile,
  MavenModuleProfile,
  NpmModuleProfile,
} from "../../../../archimate-model/profiles/profile.js";
import {
  AggregationRelationship,
  RealizationRelationship,
} from "../../../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../../../archimate-model/relationships/archi-relationship.js";
import {
  aggregationLogicalId,
  aggregationRelationshipId,
  applicationComponentIdForModule,
  applicationComponentLogicalId,
  buildModulesByRepositoryAndCoordinates,
  buildModulesByCoordinates,
  collectLibraryModuleIds,
  moduleApplicationComponentProfileFor,
  realizationLogicalId,
  realizationRelationshipId,
  resolveModuleForDependency,
} from "../../../../generate/application-module-components.js";
import { standardGenerateElementProperties } from "../../../../generate/archi-element-properties.js";
import {
  dedupeAndSortFolderIntents,
  ensureFolderPath,
  repositoryFolderSegments,
} from "../../../../generate/archi-folder-path.js";
import { withEntityDebugProperties } from "../../../../generate/generate-debug.js";
import { decorateElementName } from "../../../../generate/element-name-decoration.js";
import { isEligibleApplicationModule } from "../../../../generate/module-version-catalog.js";
import type { ApplicationModuleRecord } from "../../../../discovery-model/entities/application-module.js";
import type { ApplicationModuleDependencyRecord } from "../../../../discovery-model/entities/application-module-dependency.js";
import type { DiscoveryEntityRecord } from "../../../../discovery-model/entities/entity-types.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../../../platform/processors/processor.js";

const GENERATOR_COORDINATE = "generate.elements.application:app-components-from-modules";

const REQUIRED_PROFILES: readonly ArchiProfile[] = [
  LibraryModuleProfile.create(),
  MavenModuleProfile.create(),
  GradleModuleProfile.create(),
  NpmModuleProfile.create(),
];

export class AppComponentsFromModulesProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.application",
    artifactId: "app-components-from-modules",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Maps ApplicationModule entities to ApplicationComponents with Realization from module Artifacts and Aggregation library dependencies.";

  protected doProcess(input: GenerateProcessorInput): ArchiCreateIntents {
    const pendingFolders = new Map<string, ArchiFolderCreateIntent>();
    const folderIntents: ArchiFolderCreateIntent[] = [];
    const elements: ArchiElementCreateIntent[] = [];
    const relations: ArchiRelationshipCreateIntent[] = [];

    const profiles = REQUIRED_PROFILES.filter(
      (profile) =>
        input.archi.findProfile(profile.name, profile.conceptType) === undefined,
    );

    const repositoriesById = new Map(
      input.discovery.listEntities("Repository").map((repository) => [repository.id, repository]),
    );

    const allModules = [...input.discovery.listEntities("ApplicationModule")].map(
      (record) => record as unknown as ApplicationModuleRecord,
    );
    const modules = allModules
      .filter((record) => isEligibleApplicationModule(record as unknown as DiscoveryEntityRecord))
      .sort((left, right) => left.id.localeCompare(right.id));

    const modulesById = new Map(modules.map((module) => [module.id, module]));
    const coordinateIndex = buildModulesByRepositoryAndCoordinates(allModules);
    const modulesByCoordinate = buildModulesByCoordinates(allModules);

    const dependencies = [...input.discovery.listEntities("ApplicationModuleDependency")]
      .map((record) => record as unknown as ApplicationModuleDependencyRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const libraryModuleIds = collectLibraryModuleIds(dependencies, allModules);

    const applicationFolderId = input.archi.getPredefinedFolderId("application");

    for (const module of modules) {
      const repository = repositoriesById.get(String(module.repositoryId));
      const folderSegments = repositoryFolderSegments(repository, { includeRepoName: true });
      const targetFolder = ensureFolderPath(
        input.archi,
        applicationFolderId,
        folderSegments,
        pendingFolders,
      );
      folderIntents.push(...targetFolder.folderIntents);

      const applicationComponentId = applicationComponentIdForModule(module.id);
      if (input.archi.getElement(applicationComponentId) === undefined) {
        const profile = libraryModuleIds.has(module.id)
          ? LibraryModuleProfile.create()
          : moduleApplicationComponentProfileFor(module.buildSystem);

        let elementBuilder = ApplicationComponent.withId(applicationComponentId)
          .name(
            decorateElementName(
              "app-module-component",
              String(module.name),
              { isLibrary: libraryModuleIds.has(module.id) },
              input.options,
            ),
          )
          .inFolder(targetFolder.folderId)
          .profiles(profile.id);

        for (const property of standardGenerateElementProperties({
          logicalId: applicationComponentLogicalId(module.id),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "app-module-component",
        })) {
          elementBuilder = elementBuilder.property(property.key, property.value);
        }

        const elementIntent = withEntityDebugProperties(elementBuilder.build().toCreateIntent(), [
          {
            entityType: "ApplicationModule",
            record: module as unknown as DiscoveryEntityRecord,
          },
        ]);
        elements.push(elementIntent);
      }

      if (input.archi.getElement(module.id) === undefined) {
        continue;
      }

      const relationId = realizationRelationshipId(module.id, applicationComponentId);
      if (input.archi.getRelationship(relationId)) {
        continue;
      }

      let realizationBuilder = RealizationRelationship.withId(relationId)
        .source(module.id)
        .target(applicationComponentId);

      for (const property of standardGenerateElementProperties({
        logicalId: realizationLogicalId(module.id, applicationComponentId),
        generatorCoordinate: GENERATOR_COORDINATE,
        slot: "module-artifact-realizes",
      })) {
        realizationBuilder = realizationBuilder.property(property.key, property.value);
      }

      relations.push(realizationBuilder.build().toCreateIntent());
    }

    for (const dependency of dependencies) {
      const consumer = modulesById.get(dependency.parentId);
      if (consumer === undefined) {
        continue;
      }

      const targetModule = resolveModuleForDependency(
        coordinateIndex,
        modulesByCoordinate,
        consumer,
        dependency.groupId,
        dependency.artifactId,
      );
      if (targetModule === undefined || !isEligibleApplicationModule(targetModule as unknown as DiscoveryEntityRecord)) {
        continue;
      }

      const consumerApplicationComponentId = applicationComponentIdForModule(consumer.id);
      const libraryApplicationComponentId = applicationComponentIdForModule(targetModule.id);
      const relationId = aggregationRelationshipId(
        consumerApplicationComponentId,
        libraryApplicationComponentId,
        dependency.id,
      );
      if (input.archi.getRelationship(relationId)) {
        continue;
      }

      let aggregationBuilder = AggregationRelationship.withId(relationId)
        .source(consumerApplicationComponentId)
        .target(libraryApplicationComponentId)
        .property("c2a:libraryVersion", String(dependency.version));

      for (const property of standardGenerateElementProperties({
        logicalId: aggregationLogicalId(dependency.id),
        generatorCoordinate: GENERATOR_COORDINATE,
        slot: "module-lib-aggregation",
      })) {
        aggregationBuilder = aggregationBuilder.property(property.key, property.value);
      }

      relations.push(aggregationBuilder.build().toCreateIntent());
    }

    const existingFolderIds = new Set(input.archi.listFolders().map((folder) => folder.id));
    const uniqueFolderIntents = dedupeAndSortFolderIntents(folderIntents, existingFolderIds);

    return {
      ...(uniqueFolderIntents.length > 0 ? { folders: uniqueFolderIntents } : {}),
      ...(profiles.length > 0 ? { profiles } : {}),
      ...(elements.length > 0 ? { elements } : {}),
      ...(relations.length > 0 ? { relations } : {}),
    };
  }
}
