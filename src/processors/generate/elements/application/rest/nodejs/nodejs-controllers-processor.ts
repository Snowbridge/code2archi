import type { ArchiCreateIntents } from "../../../../../../archimate-model/archi-create-intents.js";
import {
  ApplicationService,
  type ArchiElementCreateIntent,
} from "../../../../../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../../../../../archimate-model/folders/archi-folder.js";
import type { ArchiProfile } from "../../../../../../archimate-model/profiles/profile.js";
import { RestControllerProfile } from "../../../../../../archimate-model/profiles/profile.js";
import { RealizationRelationship } from "../../../../../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../../../../../archimate-model/relationships/archi-relationship.js";
import { applicationComponentIdForModule } from "../../../../../../generate/application-module-components.js";
import { standardGenerateElementProperties } from "../../../../../../generate/archi-element-properties.js";
import {
  dedupeAndSortFolderIntents,
  ensureFolderPath,
  repositoryFolderSegments,
} from "../../../../../../generate/archi-folder-path.js";
import { withEntityDebugProperties } from "../../../../../../generate/generate-debug.js";
import {
  buildNodejsRestControllerEndpointsDocumentation,
  nodejsRestControllerRealizationLogicalId,
  nodejsRestControllerRealizationRelationshipId,
  nodejsRestControllerServiceLogicalId,
} from "../../../../../../generate/nodejs-rest-controller-services.js";
import type { ApplicationModuleRecord } from "../../../../../../discovery-model/entities/application-module.js";
import type { DiscoveryEntityRecord } from "../../../../../../discovery-model/entities/entity-types.js";
import type { NodejsRestControllerRecord } from "../../../../../../discovery-model/entities/nodejs-rest-controller.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../../../../../platform/processors/processor.js";

const GENERATOR_COORDINATE = "generate.elements.application.rest.nodejs:nodejs-controllers";

const REQUIRED_PROFILES: readonly ArchiProfile[] = [RestControllerProfile.create()];

export class NodejsControllersProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.application.rest.nodejs",
    artifactId: "nodejs-controllers",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Maps NodejsRestController entities to ApplicationServices with Realization from ApplicationComponents.";

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
      input.discovery
        .listEntities("ApplicationModule")
        .map((record) => [record.id, record as unknown as ApplicationModuleRecord]),
    );

    const controllers = [...input.discovery.listEntities("NodejsRestController")]
      .map((record) => record as unknown as NodejsRestControllerRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const applicationFolderId = input.archi.getPredefinedFolderId("application");
    const restControllerProfile = RestControllerProfile.create();

    for (const controller of controllers) {
      const module = modulesById.get(controller.applicationModuleId);
      if (module === undefined) {
        continue;
      }

      const appComponentId = applicationComponentIdForModule(module.id);
      const repository = repositoriesById.get(String(module.repositoryId));
      const folderSegments = repositoryFolderSegments(repository, { includeRepoName: true });
      const targetFolder = ensureFolderPath(
        input.archi,
        applicationFolderId,
        folderSegments,
        pendingFolders,
      );
      folderIntents.push(...targetFolder.folderIntents);

      if (input.archi.getElement(controller.id) === undefined) {
        let elementBuilder = ApplicationService.withId(controller.id)
          .name(String(controller.name))
          .inFolder(targetFolder.folderId)
          .profiles(restControllerProfile.id);

        const documentation = buildNodejsRestControllerEndpointsDocumentation(controller.endpoints);
        if (documentation !== undefined) {
          elementBuilder = elementBuilder.documentation(documentation);
        }

        for (const property of standardGenerateElementProperties({
          logicalId: nodejsRestControllerServiceLogicalId(controller.id),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "nodejs-rest-controller",
        })) {
          elementBuilder = elementBuilder.property(property.key, property.value);
        }

        elements.push(
          withEntityDebugProperties(elementBuilder.build().toCreateIntent(), [
            {
              entityType: "NodejsRestController",
              record: controller as unknown as DiscoveryEntityRecord,
            },
          ]),
        );
      }

      const relationId = nodejsRestControllerRealizationRelationshipId(
        appComponentId,
        controller.id,
      );
      if (
        input.archi.getElement(appComponentId) !== undefined &&
        !input.archi.getRelationship(relationId)
      ) {
        let realizationBuilder = RealizationRelationship.withId(relationId)
          .source(appComponentId)
          .target(controller.id);

        for (const property of standardGenerateElementProperties({
          logicalId: nodejsRestControllerRealizationLogicalId(module.id, controller.id),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "nodejs-app-module-realizes-rest-controller",
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
