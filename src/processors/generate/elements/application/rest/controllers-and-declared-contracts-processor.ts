import type { ArchiCreateIntents } from "../../../../../archimate-model/archi-create-intents.js";
import {
  ApplicationInterface,
  ApplicationService,
  type ArchiElementCreateIntent,
} from "../../../../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../../../../archimate-model/folders/archi-folder.js";
import type { ArchiProfile } from "../../../../../archimate-model/profiles/profile.js";
import {
  RestApiContractInterfaceProfile,
  RestControllerProfile,
} from "../../../../../archimate-model/profiles/profile.js";
import {
  AssignmentRelationship,
  RealizationRelationship,
} from "../../../../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../../../../archimate-model/relationships/archi-relationship.js";
import { applicationComponentIdForModule } from "../../../../../generate/application-module-components.js";
import { standardGenerateElementProperties } from "../../../../../generate/archi-element-properties.js";
import {
  dedupeAndSortFolderIntents,
  ensureFolderPath,
  repositoryFolderSegments,
} from "../../../../../generate/archi-folder-path.js";
import { withEntityDebugProperties } from "../../../../../generate/generate-debug.js";
import { buildExtractHttpApiContractInterfaceIntent } from "../../../../../generate/rest-declared-contract-elements.js";
import {
  appModuleRealizesRestControllerId,
  appModuleRealizesRestControllerLogicalId,
  businessEndpointsFrom,
  httpApiContractInterfaceId,
  httpApiContractInterfaceLogicalId,
  inferredRestApiContractInterfaceId,
  inferredRestApiContractInterfaceLogicalId,
  inferredRestApiContractName,
  INFERRED_REST_API_CONFIDENCE,
  restApiContractAssignmentId,
  restApiContractAssignmentLogicalId,
  restControllerAppServiceId,
  restControllerAppServiceLogicalId,
} from "../../../../../generate/rest-controller-elements.js";
import type { ApplicationModuleRecord } from "../../../../../code-inventory/entities/application-module.js";
import type { DiscoveryEntityRecord } from "../../../../../code-inventory/entities/entity-types.js";
import type { HttpApiContractRecord } from "../../../../../code-inventory/entities/http-api-contract.js";
import type { RestControllerRecord } from "../../../../../code-inventory/entities/rest-controller.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../../../../platform/processors/processor.js";

const GENERATOR_COORDINATE =
  "generate.elements.application.rest:controllers-and-declared-contracts";

const REQUIRED_PROFILES: readonly ArchiProfile[] = [
  RestControllerProfile.create(),
  RestApiContractInterfaceProfile.create(),
];

export class RestControllersAndDeclaredContractsProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.application.rest",
    artifactId: "controllers-and-declared-contracts",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Maps RestController and declared HttpApiContract entities to ApplicationService, ApplicationInterface, and Realization/Assignment relations.";

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

    const contractsById = new Map(
      input.discovery.listEntities("HttpApiContract").map((contract) => [contract.id, contract]),
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

      const businessEndpoints = businessEndpointsFrom(controller.endpoints);
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

      const sortedContractIds = [...controller.contractIds].sort((left, right) =>
        left.localeCompare(right),
      );

      if (sortedContractIds.length > 0) {
        for (const contractId of sortedContractIds) {
          const contract = contractsById.get(contractId) as HttpApiContractRecord | undefined;
          const interfaceId = httpApiContractInterfaceId(contractId);
          const interfaceLogicalId = httpApiContractInterfaceLogicalId(contractId);

          if (input.archi.getElement(interfaceId) === undefined) {
            elements.push(
              buildExtractHttpApiContractInterfaceIntent({
                contractId,
                contract,
                folderId: targetFolder.folderId,
                generatorCoordinate: GENERATOR_COORDINATE,
              }),
            );
          }

          const assignmentId = restApiContractAssignmentId(interfaceId, serviceId);
          if (input.archi.getRelationship(assignmentId) === undefined) {
            let assignmentBuilder = AssignmentRelationship.withId(assignmentId)
              .source(interfaceId)
              .target(serviceId);

            for (const property of standardGenerateElementProperties({
              logicalId: restApiContractAssignmentLogicalId(interfaceLogicalId, controller.id),
              generatorCoordinate: GENERATOR_COORDINATE,
              slot: "rest-api-contract-assignment",
            })) {
              assignmentBuilder = assignmentBuilder.property(property.key, property.value);
            }

            relations.push(assignmentBuilder.build().toCreateIntent());
          }
        }
        continue;
      }

      if (businessEndpoints.length === 0) {
        continue;
      }

      const inferredInterfaceId = inferredRestApiContractInterfaceId(controller.id);
      const inferredInterfaceLogicalId = inferredRestApiContractInterfaceLogicalId(controller.id);

      if (input.archi.getElement(inferredInterfaceId) === undefined) {
        let inferredInterfaceBuilder = ApplicationInterface.withId(inferredInterfaceId)
          .name(inferredRestApiContractName(controller.simpleName))
          .documentation(businessEndpoints.join("\n"))
          .inFolder(targetFolder.folderId)
          .profiles(RestApiContractInterfaceProfile.create().id);

        for (const property of standardGenerateElementProperties({
          logicalId: inferredInterfaceLogicalId,
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "rest-api-contract-interface",
          basis: "inference",
          confidence: INFERRED_REST_API_CONFIDENCE,
        })) {
          inferredInterfaceBuilder = inferredInterfaceBuilder.property(property.key, property.value);
        }

        elements.push(inferredInterfaceBuilder.build().toCreateIntent());
      }

      const inferredAssignmentId = restApiContractAssignmentId(inferredInterfaceId, serviceId);
      if (input.archi.getRelationship(inferredAssignmentId) === undefined) {
        let inferredAssignmentBuilder = AssignmentRelationship.withId(inferredAssignmentId)
          .source(inferredInterfaceId)
          .target(serviceId);

        for (const property of standardGenerateElementProperties({
          logicalId: restApiContractAssignmentLogicalId(inferredInterfaceLogicalId, controller.id),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "rest-api-contract-assignment",
          basis: "inference",
          confidence: INFERRED_REST_API_CONFIDENCE,
        })) {
          inferredAssignmentBuilder = inferredAssignmentBuilder.property(
            property.key,
            property.value,
          );
        }

        relations.push(inferredAssignmentBuilder.build().toCreateIntent());
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
