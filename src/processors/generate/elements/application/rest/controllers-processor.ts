import type { ArchiCreateIntents } from "../../../../../archimate-model/archi-create-intents.js";
import {
  ApplicationService,
  type ArchiElementCreateIntent,
} from "../../../../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../../../../archimate-model/folders/archi-folder.js";
import type { ArchiProfile } from "../../../../../archimate-model/profiles/profile.js";
import { RestControllerProfile } from "../../../../../archimate-model/profiles/profile.js";
import { RealizationRelationship } from "../../../../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../../../../archimate-model/relationships/archi-relationship.js";
import { applicationComponentIdForModule } from "../../../../../generate/application-module-components.js";
import { standardGenerateElementProperties } from "../../../../../generate/archi-element-properties.js";
import {
  dedupeAndSortFolderIntents,
  ensureFolderPath,
  repositoryFolderSegments,
} from "../../../../../generate/archi-folder-path.js";
import { withEntityDebugProperties } from "../../../../../generate/generate-debug.js";
import {
  appModuleRealizesRestControllerId,
  appModuleRealizesRestControllerLogicalId,
  restControllerAppServiceId,
  restControllerAppServiceLogicalId,
} from "../../../../../generate/rest-controller-elements.js";
import type { ApplicationModuleRecord } from "../../../../../code-inventory/entities/application-module.js";
import type { DiscoveryEntityRecord } from "../../../../../code-inventory/entities/entity-types.js";
import type { RestControllerRecord } from "../../../../../code-inventory/entities/rest-controller.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../../../../platform/processors/processor.js";

const GENERATOR_COORDINATE = "generate.elements.application.rest:controllers";

const REQUIRED_PROFILES: readonly ArchiProfile[] = [RestControllerProfile.create()];

export class RestControllersProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.application.rest",
    artifactId: "controllers",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Maps RestController entities to ApplicationService with Realization from the owning ApplicationComponent.";

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

    const modulesById = new Map(
      input.discovery.listEntities("ApplicationModule").map((module) => [module.id, module]),
    );

    const controllers = [...input.discovery.listEntities("RestController")]
      .map((record) => record as unknown as RestControllerRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const applicationFolderId = input.archi.getPredefinedFolderId("application");

    for (const controller of controllers) {
      const module = modulesById.get(controller.applicationModuleId) as
        | ApplicationModuleRecord
        | undefined;
      if (module === undefined) {
        continue;
      }

      const repository = repositoriesById.get(String(module.repositoryId));
      const folderSegments = repositoryFolderSegments(repository, { includeRepoName: true });
      const targetFolder = ensureFolderPath(
        input.archi,
        applicationFolderId,
        folderSegments,
        pendingFolders,
      );
      folderIntents.push(...targetFolder.folderIntents);

      const serviceId = restControllerAppServiceId(controller.id);
      const appComponentId = applicationComponentIdForModule(controller.applicationModuleId);

      if (input.archi.getElement(serviceId) === undefined) {
        let serviceBuilder = ApplicationService.withId(serviceId)
          .name(controller.simpleName)
          .inFolder(targetFolder.folderId)
          .profiles(RestControllerProfile.create().id);

        for (const property of standardGenerateElementProperties({
          logicalId: restControllerAppServiceLogicalId(controller.id),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "rest-controller-app-service",
        })) {
          serviceBuilder = serviceBuilder.property(property.key, property.value);
        }

        const serviceIntent = withEntityDebugProperties(serviceBuilder.build().toCreateIntent(), [
          {
            entityType: "RestController",
            record: controller as unknown as DiscoveryEntityRecord,
          },
        ]);
        elements.push(serviceIntent);
      }

      const realizationId = appModuleRealizesRestControllerId(
        controller.applicationModuleId,
        controller.id,
      );
      if (input.archi.getRelationship(realizationId) === undefined) {
        let realizationBuilder = RealizationRelationship.withId(realizationId)
          .source(appComponentId)
          .target(serviceId);

        for (const property of standardGenerateElementProperties({
          logicalId: appModuleRealizesRestControllerLogicalId(
            controller.applicationModuleId,
            controller.id,
          ),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "app-module-realizes-rest-controller",
        })) {
          realizationBuilder = realizationBuilder.property(property.key, property.value);
        }

        relations.push(realizationBuilder.build().toCreateIntent());
      }
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
