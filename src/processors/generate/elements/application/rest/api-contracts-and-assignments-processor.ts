import type { ArchiCreateIntents } from "../../../../../archimate-model/archi-create-intents.js";
import {
  ApplicationInterface,
  type ArchiElementCreateIntent,
} from "../../../../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../../../../archimate-model/folders/archi-folder.js";
import type { ArchiProfile } from "../../../../../archimate-model/profiles/profile.js";
import { RestApiContractProfile } from "../../../../../archimate-model/profiles/profile.js";
import { AssignmentRelationship } from "../../../../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../../../../archimate-model/relationships/archi-relationship.js";
import type { ApplicationModuleRecord } from "../../../../../discovery-model/entities/application-module.js";
import type { DiscoveryEntityRecord } from "../../../../../discovery-model/entities/entity-types.js";
import type { RestControllerRecord } from "../../../../../discovery-model/entities/rest-controller.js";
import type { RestClientToControllerLinkRecord } from "../../../../../discovery-model/links/rest-client-to-controller-link.js";
import { standardGenerateElementProperties } from "../../../../../generate/archi-element-properties.js";
import {
  dedupeAndSortFolderIntents,
  ensureFolderPath,
  repositoryFolderSegments,
} from "../../../../../generate/archi-folder-path.js";
import { decorateElementName } from "../../../../../generate/element-name-decoration.js";
import { withEntityDebugProperties } from "../../../../../generate/generate-debug.js";
import {
  buildRestApiContractDocumentation,
  restApiContractAssignmentLogicalId,
  restApiContractAssignmentRelationshipId,
  restApiContractElementId,
  restApiContractLogicalId,
  selectBestRestClientToControllerLinksPerClient,
} from "../../../../../generate/rest-api-contracts.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../../../../platform/processors/processor.js";

const GENERATOR_COORDINATE = "generate.elements.application.rest:api-contracts-and-assignments";

const REQUIRED_PROFILES: readonly ArchiProfile[] = [RestApiContractProfile.create()];

export class ApiContractsAndAssignmentsProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.application.rest",
    artifactId: "api-contracts-and-assignments",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Creates REST API contract ApplicationInterfaces per RestController and assigns them to controllers and matched clients.";

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

    const controllers = [...input.discovery.listEntities("RestController")]
      .map((record) => record as unknown as RestControllerRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const applicationFolderId = input.archi.getPredefinedFolderId("application");
    const contractProfile = RestApiContractProfile.create();

    for (const controller of controllers) {
      const module = modulesById.get(controller.applicationModuleId);
      if (module === undefined) {
        continue;
      }

      const contractId = restApiContractElementId(module.id, controller.fqcn);
      const repository = repositoriesById.get(String(module.repositoryId));
      const folderSegments = repositoryFolderSegments(repository, { includeRepoName: true });
      const targetFolder = ensureFolderPath(
        input.archi,
        applicationFolderId,
        folderSegments,
        pendingFolders,
      );
      folderIntents.push(...targetFolder.folderIntents);

      if (input.archi.getElement(contractId) === undefined) {
        let elementBuilder = ApplicationInterface.withId(contractId)
          .name(
            decorateElementName(
              "rest-api-contract",
              String(controller.name),
              {},
              input.options,
            ),
          )
          .inFolder(targetFolder.folderId)
          .profiles(contractProfile.id);

        const documentation = buildRestApiContractDocumentation({
          endpoints: controller.endpoints,
          dtoFqcn: controller.dtoFqcn,
          implementedInterfaceFqcn: controller.implementedInterfaceFqcn,
        });
        if (documentation !== undefined) {
          elementBuilder = elementBuilder.documentation(documentation);
        }

        for (const property of standardGenerateElementProperties({
          logicalId: restApiContractLogicalId(module.id, controller.fqcn),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "rest-api-contract",
        })) {
          elementBuilder = elementBuilder.property(property.key, property.value);
        }

        const elementIntent = withEntityDebugProperties(elementBuilder.build().toCreateIntent(), [
          {
            entityType: "RestController",
            record: controller as unknown as DiscoveryEntityRecord,
          },
        ]);
        elements.push(elementIntent);
      }

      const controllerAssignmentId = restApiContractAssignmentRelationshipId(
        contractId,
        controller.id,
      );
      if (!input.archi.getRelationship(controllerAssignmentId)) {
        let assignmentBuilder = AssignmentRelationship.withId(controllerAssignmentId)
          .source(contractId)
          .target(controller.id);

        for (const property of standardGenerateElementProperties({
          logicalId: restApiContractAssignmentLogicalId(
            module.id,
            controller.fqcn,
            "restcontroller",
            controller.id,
          ),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "rest-api-contract-assignment",
        })) {
          assignmentBuilder = assignmentBuilder.property(property.key, property.value);
        }

        relations.push(assignmentBuilder.build().toCreateIntent());
      }
    }

    const controllerFqcnById = new Map(
      controllers.map((controller) => {
        const module = modulesById.get(controller.applicationModuleId);
        return [
          controller.id,
          module === undefined ? undefined : { moduleId: module.id, fqcn: controller.fqcn },
        ] as const;
      }),
    );

    const links = input.discovery
      .listLinks("RestClientToControllerLink")
      .map((record) => record as unknown as RestClientToControllerLinkRecord)
      .map((record) => ({
        id: record.id,
        restControllerId: record.restControllerId,
        restClientId: record.restClientId,
        sourceApplicationModuleId: record.sourceApplicationModuleId,
        targetApplicationModuleId: record.targetApplicationModuleId,
        matchMethod: record.matchMethod,
        basis: record.basis,
        confidence: record.confidence,
      }));

    for (const link of selectBestRestClientToControllerLinksPerClient(links)) {
      const controllerMeta = controllerFqcnById.get(link.restControllerId);
      if (controllerMeta === undefined) {
        continue;
      }

      const contractId = restApiContractElementId(controllerMeta.moduleId, controllerMeta.fqcn);
      const assignmentId = restApiContractAssignmentRelationshipId(contractId, link.restClientId);
      if (input.archi.getRelationship(assignmentId)) {
        continue;
      }

      let assignmentBuilder = AssignmentRelationship.withId(assignmentId)
        .source(contractId)
        .target(link.restClientId);

      for (const property of standardGenerateElementProperties({
        logicalId: restApiContractAssignmentLogicalId(
          controllerMeta.moduleId,
          controllerMeta.fqcn,
          "restclient",
          link.restClientId,
        ),
        generatorCoordinate: GENERATOR_COORDINATE,
        slot: "rest-api-contract-assignment",
        basis: link.basis,
        confidence: link.confidence,
      })) {
        assignmentBuilder = assignmentBuilder.property(property.key, property.value);
      }

      relations.push(assignmentBuilder.build().toCreateIntent());
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
