import type { ArchiCreateIntents } from "../../archimate-model/archi-create-intents.js";
import {
  ApplicationInterface,
  type ArchiElementCreateIntent,
} from "../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../archimate-model/folders/archi-folder.js";
import type { ArchiProfile } from "../../archimate-model/profiles/profile.js";
import { InferredApiContractProfile } from "../../archimate-model/profiles/profile.js";
import { AssignmentRelationship } from "../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../archimate-model/relationships/archi-relationship.js";
import { standardGenerateElementProperties } from "../../generate/archi-element-properties.js";
import {
  dedupeAndSortFolderIntents,
  ensureFolderPath,
  parseNamespaceSegments,
} from "../../generate/archi-folder-path.js";
import { decorateElementName } from "../../generate/element-name-decoration.js";
import { withEntityDebugProperties } from "../../generate/generate-debug.js";
import {
  buildInferredContractDocumentation,
  inferredContractAssignmentId,
  inferredContractAssignmentLogicalId,
  inferredRestContractId,
  inferredRestContractLogicalId,
} from "../../generate/inferred-rest-contracts.js";
import type { ApplicationModuleRecord } from "../../discovery-model/entities/application-module.js";
import type { DiscoveryEntityRecord } from "../../discovery-model/entities/entity-types.js";
import type { RestControllerRecord } from "../../discovery-model/entities/rest-controller.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../platform/processors/processor.js";

const GENERATOR_COORDINATE = "generate.elements.application.rest:inferred-api-contracts";

const REQUIRED_PROFILES: readonly ArchiProfile[] = [InferredApiContractProfile.create()];

export class InferredApiContractsProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.application.rest",
    artifactId: "inferred-api-contracts",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Maps RestController endpoints and dtoFqcn to inferred ApplicationInterfaces with Assignment to REST controllers.";

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
    const inferredApiContractProfile = InferredApiContractProfile.create();

    for (const controller of controllers) {
      if (controller.endpoints.length === 0 && controller.dtoFqcn.length === 0) {
        continue;
      }

      if (input.archi.getElement(controller.id) === undefined) {
        continue;
      }

      const module = modulesById.get(controller.applicationModuleId);
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

      const contractId = inferredRestContractId(controller.fqcn);

      if (input.archi.getElement(contractId) === undefined) {
        let elementBuilder = ApplicationInterface.withId(contractId)
          .name(
            decorateElementName("inferred-rest-contract", controller.name, {}, input.options),
          )
          .documentation(
            buildInferredContractDocumentation(controller.endpoints, controller.dtoFqcn),
          )
          .inFolder(targetFolder.folderId)
          .profiles(inferredApiContractProfile.id);

        for (const property of standardGenerateElementProperties({
          logicalId: inferredRestContractLogicalId(controller.fqcn),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "inferred-rest-contract",
          confidence: "inferred",
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

      const relationId = inferredContractAssignmentId(contractId, controller.id);
      if (input.archi.getRelationship(relationId)) {
        continue;
      }

      let assignmentBuilder = AssignmentRelationship.withId(relationId)
        .source(contractId)
        .target(controller.id);

      for (const property of standardGenerateElementProperties({
        logicalId: inferredContractAssignmentLogicalId(controller.fqcn, controller.id),
        generatorCoordinate: GENERATOR_COORDINATE,
        slot: "inferred-contract-assigned-to-rest-controller",
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
