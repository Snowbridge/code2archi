import type { ArchiCreateIntents } from "../../../../../../archimate-model/archi-create-intents.js";
import {
  ApplicationInterface,
  ApplicationService,
  type ArchiElementCreateIntent,
} from "../../../../../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../../../../../archimate-model/folders/archi-folder.js";
import type { ArchiProfile } from "../../../../../../archimate-model/profiles/profile.js";
import { ApiContractProfile, RestClientProfile } from "../../../../../../archimate-model/profiles/profile.js";
import {
  AssignmentRelationship,
  RealizationRelationship,
} from "../../../../../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../../../../../archimate-model/relationships/archi-relationship.js";
import { applicationComponentIdForModule } from "../../../../../../generate/application-module-components.js";
import { standardGenerateElementProperties } from "../../../../../../generate/archi-element-properties.js";
import {
  dedupeAndSortFolderIntents,
  ensureFolderPath,
  repositoryFolderSegments,
} from "../../../../../../generate/archi-folder-path.js";
import {
  nodejsDeclaredContractAssignmentToClientId,
  nodejsDeclaredContractAssignmentToClientLogicalId,
  nodejsDeclaredRestContractId,
  nodejsDeclaredRestContractLogicalId,
} from "../../../../../../generate/nodejs-declared-rest-contracts.js";
import { simpleNameFromQualifiedSymbol } from "../../../../../../generate/nodejs-inferred-rest-contracts.js";
import {
  buildNodejsRestClientEndpointsDocumentation,
  nodejsExtendedTypeNamesList,
  nodejsRestClientRealizationLogicalId,
  nodejsRestClientRealizationRelationshipId,
  nodejsRestClientServiceLogicalId,
} from "../../../../../../generate/nodejs-rest-client-services.js";
import { decorateElementName } from "../../../../../../generate/element-name-decoration.js";
import { withEntityDebugProperties } from "../../../../../../generate/generate-debug.js";
import type { ApplicationModuleRecord } from "../../../../../../discovery-model/entities/application-module.js";
import type { DiscoveryEntityRecord } from "../../../../../../discovery-model/entities/entity-types.js";
import type { NodejsRestClientRecord } from "../../../../../../discovery-model/entities/nodejs-rest-client.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../../../../../platform/processors/processor.js";

const GENERATOR_COORDINATE =
  "generate.elements.application.rest.nodejs:nodejs-clients-and-declared-contracts";

const REQUIRED_PROFILES: readonly ArchiProfile[] = [
  RestClientProfile.create(),
  ApiContractProfile.create(),
];

export class NodejsClientsAndDeclaredContractsProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.application.rest.nodejs",
    artifactId: "nodejs-clients-and-declared-contracts",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Maps NodejsRestClient entities to ApplicationServices and declared contracts from extendsTypeNames.";

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

    const clients = [...input.discovery.listEntities("NodejsRestClient")]
      .map((record) => record as unknown as NodejsRestClientRecord)
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

        const documentation = buildNodejsRestClientEndpointsDocumentation(client.endpoints);
        if (documentation !== undefined) {
          elementBuilder = elementBuilder.documentation(documentation);
        }

        for (const property of standardGenerateElementProperties({
          logicalId: nodejsRestClientServiceLogicalId(client.id),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "nodejs-rest-client",
        })) {
          elementBuilder = elementBuilder.property(property.key, property.value);
        }

        elements.push(
          withEntityDebugProperties(elementBuilder.build().toCreateIntent(), [
            {
              entityType: "NodejsRestClient",
              record: client as unknown as DiscoveryEntityRecord,
            },
          ]),
        );
      }

      const relationId = nodejsRestClientRealizationRelationshipId(appComponentId, client.id);
      if (
        input.archi.getElement(appComponentId) !== undefined &&
        !input.archi.getRelationship(relationId)
      ) {
        let realizationBuilder = RealizationRelationship.withId(relationId)
          .source(appComponentId)
          .target(client.id);

        for (const property of standardGenerateElementProperties({
          logicalId: nodejsRestClientRealizationLogicalId(module.id, client.id),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "nodejs-app-module-realizes-rest-client",
        })) {
          realizationBuilder = realizationBuilder.property(property.key, property.value);
        }

        relations.push(realizationBuilder.build().toCreateIntent());
      }

      for (const typeName of nodejsExtendedTypeNamesList(client.extendsTypeNames)) {
        const contractId = nodejsDeclaredRestContractId(typeName);

        if (
          input.archi.getElement(contractId) === undefined &&
          !createdContractIds.has(contractId)
        ) {
          let elementBuilder = ApplicationInterface.withId(contractId)
            .name(
              decorateElementName(
                "nodejs-declared-rest-contract",
                simpleNameFromQualifiedSymbol(typeName),
                {},
                input.options,
              ),
            )
            .inFolder(targetFolder.folderId)
            .profiles(apiContractProfile.id);

          for (const property of standardGenerateElementProperties({
            logicalId: nodejsDeclaredRestContractLogicalId(typeName),
            generatorCoordinate: GENERATOR_COORDINATE,
            slot: "nodejs-declared-rest-contract",
          })) {
            elementBuilder = elementBuilder.property(property.key, property.value);
          }

          elements.push(elementBuilder.build().toCreateIntent());
          createdContractIds.add(contractId);
        }

        const assignmentId = nodejsDeclaredContractAssignmentToClientId(contractId, client.id);
        if (input.archi.getRelationship(assignmentId)) {
          continue;
        }

        let assignmentBuilder = AssignmentRelationship.withId(assignmentId)
          .source(contractId)
          .target(client.id);

        for (const property of standardGenerateElementProperties({
          logicalId: nodejsDeclaredContractAssignmentToClientLogicalId(typeName, client.id),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "nodejs-declared-contract-assigned-to-rest-client",
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
