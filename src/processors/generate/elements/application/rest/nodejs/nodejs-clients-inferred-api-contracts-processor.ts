import type { ArchiCreateIntents } from "../../../../../../archimate-model/archi-create-intents.js";
import {
  ApplicationInterface,
  type ArchiElementCreateIntent,
} from "../../../../../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../../../../../archimate-model/folders/archi-folder.js";
import type { ArchiProfile } from "../../../../../../archimate-model/profiles/profile.js";
import { InferredApiContractProfile } from "../../../../../../archimate-model/profiles/profile.js";
import { AssignmentRelationship } from "../../../../../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../../../../../archimate-model/relationships/archi-relationship.js";
import { standardGenerateElementProperties } from "../../../../../../generate/archi-element-properties.js";
import {
  dedupeAndSortFolderIntents,
  ensureFolderPath,
  parseNamespaceSegments,
} from "../../../../../../generate/archi-folder-path.js";
import { decorateElementName } from "../../../../../../generate/element-name-decoration.js";
import { withEntityDebugProperties } from "../../../../../../generate/generate-debug.js";
import {
  buildNodejsInferredContractDocumentation,
  isEligibleForNodejsInferredRestContract,
  nodejsInferredContractAssignmentToClientId,
  nodejsInferredContractAssignmentToClientLogicalId,
  nodejsInferredRestContractId,
  nodejsInferredRestContractLogicalId,
} from "../../../../../../generate/nodejs-inferred-rest-contracts.js";
import type { ApplicationModuleRecord } from "../../../../../../discovery-model/entities/application-module.js";
import type { DiscoveryEntityRecord } from "../../../../../../discovery-model/entities/entity-types.js";
import type { NodejsRestClientRecord } from "../../../../../../discovery-model/entities/nodejs-rest-client.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../../../../../platform/processors/processor.js";

const GENERATOR_COORDINATE =
  "generate.elements.application.rest.nodejs:nodejs-clients-inferred-api-contracts";

const REQUIRED_PROFILES: readonly ArchiProfile[] = [InferredApiContractProfile.create()];

export class NodejsClientsInferredApiContractsProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.application.rest.nodejs",
    artifactId: "nodejs-clients-inferred-api-contracts",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Maps NodejsRestClient endpoints to inferred ApplicationInterfaces when extendsTypeNames is empty.";

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
    const inferredApiContractProfile = InferredApiContractProfile.create();
    const createdContractIds = new Set<string>();

    for (const client of clients) {
      if (client.extendsTypeNames.length > 0) {
        continue;
      }

      if (!isEligibleForNodejsInferredRestContract(client.endpoints, client.dtoTypes)) {
        continue;
      }

      const module = modulesById.get(client.applicationModuleId);
      if (module === undefined) {
        continue;
      }

      const repository = repositoriesById.get(String(module.repositoryId));
      const namespaceSegments = parseNamespaceSegments(String(repository?.namespace ?? ""));
      const targetFolder = ensureFolderPath(
        input.archi,
        applicationFolderId,
        namespaceSegments,
        pendingFolders,
      );
      folderIntents.push(...targetFolder.folderIntents);

      const contractId = nodejsInferredRestContractId(client.qualifiedSymbol);

      if (
        input.archi.getElement(contractId) === undefined &&
        !createdContractIds.has(contractId)
      ) {
        let elementBuilder = ApplicationInterface.withId(contractId)
          .name(
            decorateElementName("nodejs-inferred-rest-contract", client.name, {}, input.options),
          )
          .documentation(
            buildNodejsInferredContractDocumentation(client.endpoints, client.dtoTypes),
          )
          .inFolder(targetFolder.folderId)
          .profiles(inferredApiContractProfile.id);

        for (const property of standardGenerateElementProperties({
          logicalId: nodejsInferredRestContractLogicalId(client.qualifiedSymbol),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "nodejs-inferred-rest-contract",
          confidence: "inferred",
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
        createdContractIds.add(contractId);
      }

      const relationId = nodejsInferredContractAssignmentToClientId(contractId, client.id);
      if (input.archi.getRelationship(relationId)) {
        continue;
      }

      let assignmentBuilder = AssignmentRelationship.withId(relationId)
        .source(contractId)
        .target(client.id);

      for (const property of standardGenerateElementProperties({
        logicalId: nodejsInferredContractAssignmentToClientLogicalId(
          client.qualifiedSymbol,
          client.id,
        ),
        generatorCoordinate: GENERATOR_COORDINATE,
        slot: "nodejs-inferred-contract-assigned-to-rest-client",
        confidence: "inferred",
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
