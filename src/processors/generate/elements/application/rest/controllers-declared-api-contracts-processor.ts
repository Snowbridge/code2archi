import type { ArchiCreateIntents } from "../../../../../archimate-model/archi-create-intents.js";
import {
  ApplicationInterface,
  type ArchiElementCreateIntent,
} from "../../../../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../../../../archimate-model/folders/archi-folder.js";
import type { ArchiProfile } from "../../../../../archimate-model/profiles/profile.js";
import { ApiContractProfile } from "../../../../../archimate-model/profiles/profile.js";
import { AssignmentRelationship } from "../../../../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../../../../archimate-model/relationships/archi-relationship.js";
import { standardGenerateElementProperties } from "../../../../../generate/archi-element-properties.js";
import {
  declaredContractAssignmentId,
  declaredContractAssignmentLogicalId,
  declaredRestContractId,
  declaredRestContractLogicalId,
  simpleNameFromFqcn,
} from "../../../../../generate/declared-rest-contracts.js";
import {
  dedupeAndSortFolderIntents,
  ensureFolderPath,
  parseNamespaceSegments,
} from "../../../../../generate/archi-folder-path.js";
import { decorateElementName } from "../../../../../generate/element-name-decoration.js";
import { withEntityDebugProperties } from "../../../../../generate/generate-debug.js";
import type { ApplicationModuleRecord } from "../../../../../discovery-model/entities/application-module.js";
import type { DiscoveryEntityRecord } from "../../../../../discovery-model/entities/entity-types.js";
import type { RestControllerRecord } from "../../../../../discovery-model/entities/rest-controller.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../../../../platform/processors/processor.js";

const GENERATOR_COORDINATE =
  "generate.elements.application.rest:controllers-declared-api-contracts";

const REQUIRED_PROFILES: readonly ArchiProfile[] = [ApiContractProfile.create()];

export class ControllersDeclaredApiContractsProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.application.rest",
    artifactId: "controllers-declared-api-contracts",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Maps RestController implementedInterfaceFqcn to ApplicationInterfaces with Assignment to REST controllers.";

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
    const apiContractProfile = ApiContractProfile.create();
    const createdContractIds = new Set<string>();

    for (const controller of controllers) {
      if (controller.implementedInterfaceFqcn.length === 0) {
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

      const interfaceFqcnList = [...controller.implementedInterfaceFqcn].sort((left, right) =>
        left.localeCompare(right),
      );

      for (const interfaceFqcn of interfaceFqcnList) {
        const contractId = declaredRestContractId(interfaceFqcn);

        if (
          input.archi.getElement(contractId) === undefined &&
          !createdContractIds.has(contractId)
        ) {
          const simpleName = simpleNameFromFqcn(interfaceFqcn);
          let elementBuilder = ApplicationInterface.withId(contractId)
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
            elementBuilder = elementBuilder.property(property.key, property.value);
          }

          const elementIntent = withEntityDebugProperties(elementBuilder.build().toCreateIntent(), [
            {
              entityType: "RestController",
              record: controller as unknown as DiscoveryEntityRecord,
            },
          ]);
          elements.push(elementIntent);
          createdContractIds.add(contractId);
        }

        const relationId = declaredContractAssignmentId(contractId, controller.id);
        if (input.archi.getRelationship(relationId)) {
          continue;
        }

        let assignmentBuilder = AssignmentRelationship.withId(relationId)
          .source(contractId)
          .target(controller.id);

        for (const property of standardGenerateElementProperties({
          logicalId: declaredContractAssignmentLogicalId(interfaceFqcn, controller.id),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "declared-contract-assigned-to-rest-controller",
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
