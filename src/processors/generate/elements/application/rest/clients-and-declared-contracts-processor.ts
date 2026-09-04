import type { ArchiCreateIntents } from "../../../../../archimate-model/archi-create-intents.js";
import {
  ApplicationInterface,
  ApplicationService,
  type ArchiElementCreateIntent,
} from "../../../../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../../../../archimate-model/folders/archi-folder.js";
import type { ArchiProfile } from "../../../../../archimate-model/profiles/profile.js";
import { ApiContractProfile, RestClientProfile } from "../../../../../archimate-model/profiles/profile.js";
import { AssignmentRelationship } from "../../../../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../../../../archimate-model/relationships/archi-relationship.js";
import { RealizationRelationship } from "../../../../../archimate-model/relationships/archi-relationship.js";
import { applicationComponentIdForModule } from "../../../../../generate/application-module-components.js";
import { standardGenerateElementProperties } from "../../../../../generate/archi-element-properties.js";
import {
  dedupeAndSortFolderIntents,
  ensureFolderPath,
  repositoryFolderSegments,
} from "../../../../../generate/archi-folder-path.js";
import {
  declaredContractAssignmentToClientId,
  declaredContractAssignmentToClientLogicalId,
  declaredRestContractId,
  declaredRestContractLogicalId,
  simpleNameFromFqcn,
} from "../../../../../generate/declared-rest-contracts.js";
import { decorateElementName } from "../../../../../generate/element-name-decoration.js";
import { withEntityDebugProperties } from "../../../../../generate/generate-debug.js";
import {
  buildRestClientEndpointsDocumentation,
  extendedInterfaceFqcnList,
  restClientRealizationLogicalId,
  restClientRealizationRelationshipId,
  restClientServiceLogicalId,
} from "../../../../../generate/rest-client-services.js";
import type { ApplicationModuleRecord } from "../../../../../discovery-model/entities/application-module.js";
import type { DiscoveryEntityRecord } from "../../../../../discovery-model/entities/entity-types.js";
import type { RestClientRecord } from "../../../../../discovery-model/entities/rest-client.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../../../../platform/processors/processor.js";

const GENERATOR_COORDINATE =
  "generate.elements.application.rest:clients-and-declared-contracts";

const REQUIRED_PROFILES: readonly ArchiProfile[] = [
  RestClientProfile.create(),
  ApiContractProfile.create(),
];

export class ClientsAndDeclaredContractsProcessor extends AbstractProcessor<
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
    "Maps RestClient entities to ApplicationServices with Realization from ApplicationComponents and declared API contracts.";

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

    const clients = [...input.discovery.listEntities("RestClient")]
      .map((record) => record as unknown as RestClientRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const applicationFolderId = input.archi.getPredefinedFolderId("application");
    const restClientProfile = RestClientProfile.create();
    const apiContractProfile = ApiContractProfile.create();
    const createdContractIds = new Set<string>();

    for (const client of clients) {
      const module = modulesById.get(client.applicationModuleId);
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

      if (input.archi.getElement(client.id) === undefined) {
        let elementBuilder = ApplicationService.withId(client.id)
          .name(String(client.name))
          .inFolder(targetFolder.folderId)
          .profiles(restClientProfile.id);

        const documentation = buildRestClientEndpointsDocumentation(client.endpoints);
        if (documentation !== undefined) {
          elementBuilder = elementBuilder.documentation(documentation);
        }

        for (const property of standardGenerateElementProperties({
          logicalId: restClientServiceLogicalId(client.id),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "rest-client",
        })) {
          elementBuilder = elementBuilder.property(property.key, property.value);
        }

        elementBuilder = elementBuilder.property("c2a:tcpStackType", client.tcpStackType);
        if (client.baseUrl !== undefined) {
          elementBuilder = elementBuilder.property("c2a:baseUrl", client.baseUrl);
        }

        const elementIntent = withEntityDebugProperties(elementBuilder.build().toCreateIntent(), [
          {
            entityType: "RestClient",
            record: client as unknown as DiscoveryEntityRecord,
          },
        ]);
        elements.push(elementIntent);
      }

      const realizationId = restClientRealizationRelationshipId(appComponentId, client.id);
      if (
        input.archi.getElement(appComponentId) !== undefined &&
        !input.archi.getRelationship(realizationId)
      ) {
        let realizationBuilder = RealizationRelationship.withId(realizationId)
          .source(appComponentId)
          .target(client.id);

        for (const property of standardGenerateElementProperties({
          logicalId: restClientRealizationLogicalId(module.id, client.id),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "app-module-realizes-rest-client",
        })) {
          realizationBuilder = realizationBuilder.property(property.key, property.value);
        }

        relations.push(realizationBuilder.build().toCreateIntent());
      }

      if (client.extendedInterfaceFqcn.length === 0) {
        continue;
      }

      for (const interfaceFqcn of extendedInterfaceFqcnList(client)) {
        const contractId = declaredRestContractId(interfaceFqcn);

        if (
          input.archi.getElement(contractId) === undefined &&
          !createdContractIds.has(contractId)
        ) {
          const simpleName = simpleNameFromFqcn(interfaceFqcn);
          let contractBuilder = ApplicationInterface.withId(contractId)
            .name(
              decorateElementName("declared-rest-contract", simpleName, {}, input.options),
            )
            .inFolder(targetFolder.folderId)
            .profiles(apiContractProfile.id);

          for (const property of standardGenerateElementProperties({
            logicalId: declaredRestContractLogicalId(interfaceFqcn),
            generatorCoordinate: GENERATOR_COORDINATE,
            slot: "declared-rest-contract",
          })) {
            contractBuilder = contractBuilder.property(property.key, property.value);
          }

          const contractIntent = withEntityDebugProperties(
            contractBuilder.build().toCreateIntent(),
            [
              {
                entityType: "RestClient",
                record: client as unknown as DiscoveryEntityRecord,
              },
            ],
          );
          elements.push(contractIntent);
          createdContractIds.add(contractId);
        }

        const assignmentId = declaredContractAssignmentToClientId(contractId, client.id);
        if (input.archi.getRelationship(assignmentId)) {
          continue;
        }

        let assignmentBuilder = AssignmentRelationship.withId(assignmentId)
          .source(contractId)
          .target(client.id);

        for (const property of standardGenerateElementProperties({
          logicalId: declaredContractAssignmentToClientLogicalId(interfaceFqcn, client.id),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "declared-contract-assigned-to-rest-client",
        })) {
          assignmentBuilder = assignmentBuilder.property(property.key, property.value);
        }

        relations.push(assignmentBuilder.build().toCreateIntent());
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
