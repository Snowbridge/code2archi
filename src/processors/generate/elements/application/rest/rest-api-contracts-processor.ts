import type { ArchiCreateIntents } from "../../../../../archimate-model/archi-create-intents.js";
import type { ArchiElementCreateIntent } from "../../../../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../../../../archimate-model/folders/archi-folder.js";
import type { ArchiProfile } from "../../../../../archimate-model/profiles/profile.js";
import { RestApiContractInterfaceProfile } from "../../../../../archimate-model/profiles/profile.js";
import { AssignmentRelationship } from "../../../../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../../../../archimate-model/relationships/archi-relationship.js";
import { standardGenerateElementProperties } from "../../../../../generate/archi-element-properties.js";
import {
  dedupeAndSortFolderIntents,
  ensureFolderPath,
  repositoryFolderSegments,
} from "../../../../../generate/archi-folder-path.js";
import { buildHttpApiContractInterfaceIntent } from "../../../../../generate/rest-declared-contract-elements.js";
import { effectiveContractIdsForAssignee } from "../../../../../code-inventory/rest-effective-contract-ids.js";
import {
  httpApiContractInterfaceId,
  httpApiContractInterfaceLogicalId,
  restApiContractAssignmentId,
  restApiContractAssignmentLogicalId,
  restClientAppServiceId,
  restControllerAppServiceId,
} from "../../../../../generate/rest-controller-elements.js";
import type { ApplicationModuleRecord } from "../../../../../code-inventory/entities/application-module.js";
import type { HttpApiContractRecord } from "../../../../../code-inventory/entities/http-api-contract.js";
import type { RestClientRecord } from "../../../../../code-inventory/entities/rest-client.js";
import type { RestControllerRecord } from "../../../../../code-inventory/entities/rest-controller.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../../../../platform/processors/processor.js";

const GENERATOR_COORDINATE = "generate.elements.application.rest:rest-api-contracts";

const REQUIRED_PROFILES: readonly ArchiProfile[] = [RestApiContractInterfaceProfile.create()];

export class RestApiContractsProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.application.rest",
    artifactId: "rest-api-contracts",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ON_DEMAND" as const;

  readonly description =
    "Maps declared HttpApiContract entities to ApplicationInterface with Assignment to controller and client ApplicationServices.";

  protected doProcess(input: GenerateProcessorInput): ArchiCreateIntents {
    const pendingFolders = new Map<string, ArchiFolderCreateIntent>();
    const folderIntents: ArchiFolderCreateIntent[] = [];
    const elements: ArchiElementCreateIntent[] = [];
    const relations: ArchiRelationshipCreateIntent[] = [];
    const emittedElementIds = new Set<string>();
    const emittedRelationIds = new Set<string>();

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

    const clients = [...input.discovery.listEntities("RestClient")]
      .map((record) => record as unknown as RestClientRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const applicationFolderId = input.archi.getPredefinedFolderId("application");

    for (const controller of controllers) {
      const module = modulesById.get(controller.applicationModuleId) as
        | ApplicationModuleRecord
        | undefined;
      if (module === undefined) {
        continue;
      }

      const targetFolderId = this.ensureModuleFolder(
        input,
        module,
        repositoriesById,
        applicationFolderId,
        pendingFolders,
        folderIntents,
      );

      const serviceId = restControllerAppServiceId(controller.id);
      const sortedContractIds = effectiveContractIdsForAssignee(
        controller.contractIds,
        controller.id,
        input.discovery,
      );

      for (const contractId of sortedContractIds) {
        const contract = contractsById.get(contractId) as HttpApiContractRecord | undefined;
        this.emitContractAssignment(
          input,
          contractId,
          contract,
          targetFolderId,
          serviceId,
          restApiContractAssignmentLogicalId(
            httpApiContractInterfaceLogicalId(contractId),
            controller.id,
          ),
          elements,
          relations,
          emittedElementIds,
          emittedRelationIds,
        );
      }
    }

    for (const client of clients) {
      const module = modulesById.get(client.applicationModuleId) as
        | ApplicationModuleRecord
        | undefined;
      if (module === undefined) {
        continue;
      }

      const sortedContractIds = effectiveContractIdsForAssignee(
        client.contractIds,
        client.id,
        input.discovery,
      );
      if (sortedContractIds.length === 0) {
        continue;
      }

      const targetFolderId = this.ensureModuleFolder(
        input,
        module,
        repositoriesById,
        applicationFolderId,
        pendingFolders,
        folderIntents,
      );

      const serviceId = restClientAppServiceId(client.id);
      for (const contractId of sortedContractIds) {
        const contract = contractsById.get(contractId) as HttpApiContractRecord | undefined;
        this.emitContractAssignment(
          input,
          contractId,
          contract,
          targetFolderId,
          serviceId,
          restApiContractAssignmentLogicalId(
            httpApiContractInterfaceLogicalId(contractId),
            client.id,
          ),
          elements,
          relations,
          emittedElementIds,
          emittedRelationIds,
        );
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

  private ensureModuleFolder(
    input: GenerateProcessorInput,
    module: ApplicationModuleRecord,
    repositoriesById: ReadonlyMap<string, unknown>,
    applicationFolderId: string,
    pendingFolders: Map<string, ArchiFolderCreateIntent>,
    folderIntents: ArchiFolderCreateIntent[],
  ): string {
    const repository = repositoriesById.get(String(module.repositoryId));
    const folderSegments = repositoryFolderSegments(repository, { includeRepoName: true });
    const targetFolder = ensureFolderPath(
      input.archi,
      applicationFolderId,
      folderSegments,
      pendingFolders,
    );
    folderIntents.push(...targetFolder.folderIntents);
    return targetFolder.folderId;
  }

  private emitContractAssignment(
    input: GenerateProcessorInput,
    contractId: string,
    contract: HttpApiContractRecord | undefined,
    folderId: string,
    serviceId: string,
    assignmentLogicalId: string,
    elements: ArchiElementCreateIntent[],
    relations: ArchiRelationshipCreateIntent[],
    emittedElementIds: Set<string>,
    emittedRelationIds: Set<string>,
  ): void {
    const interfaceId = httpApiContractInterfaceId(contractId);
    const basis = contract?.basis ?? "extract";
    const confidence = contract?.confidence;

    if (
      input.archi.getElement(interfaceId) === undefined &&
      !emittedElementIds.has(interfaceId)
    ) {
      elements.push(
        buildHttpApiContractInterfaceIntent({
          contractId,
          contract,
          folderId,
          generatorCoordinate: GENERATOR_COORDINATE,
        }),
      );
      emittedElementIds.add(interfaceId);
    }

    this.emitAssignment(
      input,
      interfaceId,
      serviceId,
      assignmentLogicalId,
      basis,
      confidence,
      relations,
      emittedRelationIds,
    );
  }

  private emitAssignment(
    input: GenerateProcessorInput,
    interfaceId: string,
    serviceId: string,
    assignmentLogicalId: string,
    basis: "extract" | "inference",
    confidence: number | undefined,
    relations: ArchiRelationshipCreateIntent[],
    emittedRelationIds: Set<string>,
  ): void {
    const assignmentId = restApiContractAssignmentId(interfaceId, serviceId);
    if (input.archi.getRelationship(assignmentId) !== undefined || emittedRelationIds.has(assignmentId)) {
      return;
    }

    let assignmentBuilder = AssignmentRelationship.withId(assignmentId)
      .source(interfaceId)
      .target(serviceId);

    for (const property of standardGenerateElementProperties({
      logicalId: assignmentLogicalId,
      generatorCoordinate: GENERATOR_COORDINATE,
      slot: "rest-api-contract-assignment",
      basis,
      confidence,
    })) {
      assignmentBuilder = assignmentBuilder.property(property.key, property.value);
    }

    relations.push(assignmentBuilder.build().toCreateIntent());
    emittedRelationIds.add(assignmentId);
  }
}
