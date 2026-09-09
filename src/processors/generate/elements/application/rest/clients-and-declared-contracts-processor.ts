import type { ArchiCreateIntents } from "../../../../../archimate-model/archi-create-intents.js";
import {
  ApplicationService,
  type ArchiElementCreateIntent,
} from "../../../../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../../../../archimate-model/folders/archi-folder.js";
import type { ArchiProfile } from "../../../../../archimate-model/profiles/profile.js";
import {
  RestApiContractInterfaceProfile,
  RestClientProfile,
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
  appModuleRealizesRestClientId,
  appModuleRealizesRestClientLogicalId,
  httpApiContractInterfaceId,
  httpApiContractInterfaceLogicalId,
  restApiContractAssignmentId,
  restApiContractAssignmentLogicalIdForRestClient,
  restClientAppServiceId,
  restClientAppServiceLogicalId,
} from "../../../../../generate/rest-controller-elements.js";
import type { ApplicationModuleRecord } from "../../../../../code-inventory/entities/application-module.js";
import type { DiscoveryEntityRecord } from "../../../../../code-inventory/entities/entity-types.js";
import type { HttpApiContractRecord } from "../../../../../code-inventory/entities/http-api-contract.js";
import type { RestClientRecord } from "../../../../../code-inventory/entities/rest-client.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../../../../platform/processors/processor.js";

const GENERATOR_COORDINATE = "generate.elements.application.rest:clients-and-declared-contracts";

const REQUIRED_PROFILES: readonly ArchiProfile[] = [
  RestClientProfile.create(),
  RestApiContractInterfaceProfile.create(),
];

export class RestClientsAndDeclaredContractsProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.application.rest",
    artifactId: "clients-and-declared-contracts",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Maps RestClient and declared HttpApiContract entities to ApplicationService, ApplicationInterface, and Realization/Assignment relations.";

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

    const clients = [...input.discovery.listEntities("RestClient")]
      .map((record) => record as unknown as RestClientRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const applicationFolderId = input.archi.getPredefinedFolderId("application");

    for (const client of clients) {
      const module = modulesById.get(client.applicationModuleId) as ApplicationModuleRecord | undefined;
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

      const serviceId = restClientAppServiceId(client.id);
      const appComponentId = applicationComponentIdForModule(client.applicationModuleId);

      if (input.archi.getElement(serviceId) === undefined) {
        let serviceBuilder = ApplicationService.withId(serviceId)
          .name(client.simpleName)
          .inFolder(targetFolder.folderId)
          .profiles(RestClientProfile.create().id);

        for (const property of standardGenerateElementProperties({
          logicalId: restClientAppServiceLogicalId(client.id),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "rest-client-app-service",
        })) {
          serviceBuilder = serviceBuilder.property(property.key, property.value);
        }

        const serviceIntent = withEntityDebugProperties(serviceBuilder.build().toCreateIntent(), [
          {
            entityType: "RestClient",
            record: client as unknown as DiscoveryEntityRecord,
          },
        ]);
        elements.push(serviceIntent);
      }

      const realizationId = appModuleRealizesRestClientId(client.applicationModuleId, client.id);
      if (input.archi.getRelationship(realizationId) === undefined) {
        let realizationBuilder = RealizationRelationship.withId(realizationId)
          .source(appComponentId)
          .target(serviceId);

        for (const property of standardGenerateElementProperties({
          logicalId: appModuleRealizesRestClientLogicalId(client.applicationModuleId, client.id),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "app-module-realizes-rest-client",
        })) {
          realizationBuilder = realizationBuilder.property(property.key, property.value);
        }

        relations.push(realizationBuilder.build().toCreateIntent());
      }

      const sortedContractIds = [...client.contractIds].sort((left, right) =>
        left.localeCompare(right),
      );

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
            logicalId: restApiContractAssignmentLogicalIdForRestClient(
              interfaceLogicalId,
              client.id,
            ),
            generatorCoordinate: GENERATOR_COORDINATE,
            slot: "rest-api-contract-assignment",
          })) {
            assignmentBuilder = assignmentBuilder.property(property.key, property.value);
          }

          relations.push(assignmentBuilder.build().toCreateIntent());
        }
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
