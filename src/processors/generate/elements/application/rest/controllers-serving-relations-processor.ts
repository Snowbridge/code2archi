import type { ArchiCreateIntents } from "../../../../../archimate-model/archi-create-intents.js";
import type { ArchiFolderCreateIntent } from "../../../../../archimate-model/folders/archi-folder.js";
import type { ArchiProfile } from "../../../../../archimate-model/profiles/profile.js";
import { ProcessesRestQueriesProfile } from "../../../../../archimate-model/profiles/profile.js";
import { ServingRelationship } from "../../../../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../../../../archimate-model/relationships/archi-relationship.js";
import { applicationComponentIdForModule } from "../../../../../generate/application-module-components.js";
import type { GenerateBasis } from "../../../../../generate/archi-element-properties.js";
import { standardGenerateElementProperties } from "../../../../../generate/archi-element-properties.js";
import {
  effectiveContractIdsForAssignee,
  inferredAssignmentConfidenceByContract,
} from "../../../../../code-inventory/rest-effective-contract-ids.js";
import type { CodeInventorySnapshot } from "../../../../../code-inventory/code-inventory-snapshot.js";
import {
  dedupeAndSortFolderIntents,
  ensureFolderPath,
  repositoryFolderSegments,
} from "../../../../../generate/archi-folder-path.js";
import {
  restClientAppServiceId,
  restControllerAppServiceId,
  restControllerServesAppComponentId,
  restControllerServesAppComponentLogicalId,
  restControllerServesRestClientId,
  restControllerServesRestClientLogicalId,
} from "../../../../../generate/rest-controller-elements.js";
import type { ApplicationModuleRecord } from "../../../../../code-inventory/entities/application-module.js";
import type { RestClientRecord } from "../../../../../code-inventory/entities/rest-client.js";
import type { RestControllerRecord } from "../../../../../code-inventory/entities/rest-controller.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../../../../platform/processors/processor.js";

const GENERATOR_COORDINATE = "generate.elements.application.rest:controllers-serving-relations";

const REQUIRED_PROFILES: readonly ArchiProfile[] = [ProcessesRestQueriesProfile.create()];

/**
 * Direct Serving relationships from REST controllers to REST clients and to
 * consumer ApplicationComponents, matched by intersection of declared
 * `contractIds`. See
 * documentation/specifications/cli/generate/processors/generate/elements/application/rest/controllers-serving-relations.md.
 */
export class RestControllersServingRelationsProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.application.rest",
    artifactId: "controllers-serving-relations",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Maps declared contract overlaps between RestController and RestClient entities to Serving relationships towards client services and consumer components.";

  protected doProcess(input: GenerateProcessorInput): ArchiCreateIntents {
    const pendingFolders = new Map<string, ArchiFolderCreateIntent>();
    const folderIntents: ArchiFolderCreateIntent[] = [];
    const relations: ArchiRelationshipCreateIntent[] = [];
    const emittedRelationIds = new Set<string>();

    const profiles = REQUIRED_PROFILES.filter(
      (profile) =>
        input.archi.findProfile(profile.name, profile.conceptType) === undefined,
    );

    const repositoriesById = new Map(
      input.discovery.listEntities("Repository").map((repository) => [repository.id, repository]),
    );

    const allModules = [...input.discovery.listEntities("ApplicationModule")].map(
      (record) => record as unknown as ApplicationModuleRecord,
    );
    const modulesById = new Map(allModules.map((module) => [module.id, module]));

    const controllers = [...input.discovery.listEntities("RestController")]
      .map((record) => record as unknown as RestControllerRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const clients = [...input.discovery.listEntities("RestClient")]
      .map((record) => record as unknown as RestClientRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const clientsByContract = this.buildClientsByContract(
      clients,
      modulesById,
      input.discovery,
    );

    const applicationFolderId = input.archi.getPredefinedFolderId("application");

    for (const controller of controllers) {
      const module = modulesById.get(controller.applicationModuleId) as
        | ApplicationModuleRecord
        | undefined;
      if (module === undefined) {
        continue;
      }

      this.ensureApplicationFolder(
        input,
        module,
        repositoriesById,
        applicationFolderId,
        pendingFolders,
        folderIntents,
      );

      const controllerServiceId = restControllerAppServiceId(controller.id);
      const matchedClients = this.findMatchedClients(
        controller,
        clientsByContract,
        input.discovery,
      );
      if (matchedClients.length === 0) {
        continue;
      }

      for (const { client, sharedContractIds } of matchedClients) {
        const servingMeta = this.resolveServingMetadata(
          sharedContractIds,
          controller,
          client,
          input.discovery,
        );
        this.emitServingToClient(
          input,
          controller,
          client,
          controllerServiceId,
          servingMeta,
          relations,
          emittedRelationIds,
        );
      }

      for (const record of this.collectComponentKeys(matchedClients, controller, input.discovery)) {
        this.emitServingToComponent(
          input,
          controller,
          record,
          controllerServiceId,
          relations,
          emittedRelationIds,
        );
      }
    }

    const existingFolderIds = new Set(input.archi.listFolders().map((folder) => folder.id));
    const uniqueFolderIntents = dedupeAndSortFolderIntents(folderIntents, existingFolderIds);

    return {
      ...(uniqueFolderIntents.length > 0 ? { folders: uniqueFolderIntents } : {}),
      ...(profiles.length > 0 ? { profiles } : {}),
      ...(relations.length > 0 ? { relations } : {}),
    };
  }

  private buildClientsByContract(
    clients: readonly RestClientRecord[],
    modulesById: ReadonlyMap<string, ApplicationModuleRecord>,
    discovery: CodeInventorySnapshot,
  ): ReadonlyMap<string, readonly RestClientRecord[]> {
    const index = new Map<string, RestClientRecord[]>();

    for (const client of clients) {
      if (!modulesById.has(client.applicationModuleId)) {
        continue;
      }

      for (const contractId of effectiveContractIdsForAssignee(
        client.contractIds,
        client.id,
        discovery,
      )) {
        const bucket = index.get(contractId);
        if (bucket === undefined) {
          index.set(contractId, [client]);
        } else {
          bucket.push(client);
        }
      }
    }

    return index;
  }

  private findMatchedClients(
    controller: RestControllerRecord,
    clientsByContract: ReadonlyMap<string, readonly RestClientRecord[]>,
    discovery: CodeInventorySnapshot,
  ): readonly { client: RestClientRecord; sharedContractIds: readonly string[] }[] {
    const sortedContractIds = effectiveContractIdsForAssignee(
      controller.contractIds,
      controller.id,
      discovery,
    );
    if (sortedContractIds.length === 0) {
      return [];
    }

    const sharedByClientId = new Map<string, { client: RestClientRecord; shared: Set<string> }>();
    for (const contractId of sortedContractIds) {
      for (const client of clientsByContract.get(contractId) ?? []) {
        let entry = sharedByClientId.get(client.id);
        if (entry === undefined) {
          entry = { client, shared: new Set<string>() };
          sharedByClientId.set(client.id, entry);
        }
        entry.shared.add(contractId);
      }
    }

    return [...sharedByClientId.values()]
      .sort((left, right) => left.client.id.localeCompare(right.client.id))
      .map((entry) => ({
        client: entry.client,
        sharedContractIds: [...entry.shared].sort((left, right) => left.localeCompare(right)),
      }));
  }

  private collectComponentKeys(
    matchedClients: readonly { client: RestClientRecord; sharedContractIds: readonly string[] }[],
    controller: RestControllerRecord,
    discovery: CodeInventorySnapshot,
  ): readonly {
    contractId: string;
    consumerModuleId: string;
    basis: GenerateBasis;
    confidence?: number;
  }[] {
    const keys = new Map<
      string,
      { contractId: string; consumerModuleId: string; basis: GenerateBasis; confidence?: number }
    >();
    for (const { client, sharedContractIds } of matchedClients) {
      for (const contractId of sharedContractIds) {
        const key = contractId + "\u0000" + client.applicationModuleId;
        if (keys.has(key)) {
          continue;
        }
        const meta = this.resolveServingMetadata(
          [contractId],
          controller,
          client,
          discovery,
        );
        keys.set(key, {
          contractId,
          consumerModuleId: client.applicationModuleId,
          basis: meta.basis,
          confidence: meta.confidence,
        });
      }
    }

    return [...keys.values()].sort((left, right) =>
      (left.contractId + left.consumerModuleId).localeCompare(
        right.contractId + right.consumerModuleId,
      ),
    );
  }

  private resolveServingMetadata(
    sharedContractIds: readonly string[],
    controller: RestControllerRecord,
    client: RestClientRecord,
    discovery: CodeInventorySnapshot,
  ): { basis: GenerateBasis; confidence?: number } {
    const declaredShared = sharedContractIds.filter(
      (contractId) =>
        controller.contractIds.includes(contractId) && client.contractIds.includes(contractId),
    );
    if (declaredShared.length > 0) {
      return { basis: "extract" };
    }

    const clientInferred = inferredAssignmentConfidenceByContract(client.id, discovery);
    let minConfidence = 1;
    for (const contractId of sharedContractIds) {
      const value = clientInferred.get(contractId);
      if (value !== undefined && value < minConfidence) {
        minConfidence = value;
      }
    }
    return { basis: "inference", confidence: minConfidence };
  }

  private ensureApplicationFolder(
    input: GenerateProcessorInput,
    module: ApplicationModuleRecord,
    repositoriesById: ReadonlyMap<string, unknown>,
    applicationFolderId: string,
    pendingFolders: Map<string, ArchiFolderCreateIntent>,
    folderIntents: ArchiFolderCreateIntent[],
  ): void {
    const repository = repositoriesById.get(String(module.repositoryId));
    const folderSegments = repositoryFolderSegments(repository, { includeRepoName: true });
    const targetFolder = ensureFolderPath(
      input.archi,
      applicationFolderId,
      folderSegments,
      pendingFolders,
    );
    folderIntents.push(...targetFolder.folderIntents);
  }

  private emitServingToClient(
    input: GenerateProcessorInput,
    controller: RestControllerRecord,
    client: RestClientRecord,
    controllerServiceId: string,
    servingMeta: { basis: GenerateBasis; confidence?: number },
    relations: ArchiRelationshipCreateIntent[],
    emittedRelationIds: Set<string>,
  ): void {
    const clientServiceId = restClientAppServiceId(client.id);
    const relationId = restControllerServesRestClientId(controllerServiceId, clientServiceId);
    if (input.archi.getRelationship(relationId) !== undefined || emittedRelationIds.has(relationId)) {
      return;
    }

    let builder = ServingRelationship.withId(relationId)
      .source(controllerServiceId)
      .target(clientServiceId)
      .profiles(ProcessesRestQueriesProfile.create().id);

    for (const property of standardGenerateElementProperties({
      logicalId: restControllerServesRestClientLogicalId(controller.id, client.id),
      generatorCoordinate: GENERATOR_COORDINATE,
      slot: "rest-controller-serves-rest-client",
      basis: servingMeta.basis,
      confidence: servingMeta.confidence,
    })) {
      builder = builder.property(property.key, property.value);
    }

    relations.push(builder.build().toCreateIntent());
    emittedRelationIds.add(relationId);
  }

  private emitServingToComponent(
    input: GenerateProcessorInput,
    controller: RestControllerRecord,
    record: {
      contractId: string;
      consumerModuleId: string;
      basis: GenerateBasis;
      confidence?: number;
    },
    controllerServiceId: string,
    relations: ArchiRelationshipCreateIntent[],
    emittedRelationIds: Set<string>,
  ): void {
    const consumerComponentId = applicationComponentIdForModule(record.consumerModuleId);
    const relationId = restControllerServesAppComponentId(
      controllerServiceId,
      consumerComponentId,
      record.contractId,
    );
    if (input.archi.getRelationship(relationId) !== undefined || emittedRelationIds.has(relationId)) {
      return;
    }

    let builder = ServingRelationship.withId(relationId)
      .source(controllerServiceId)
      .target(consumerComponentId)
      .profiles(ProcessesRestQueriesProfile.create().id);

    for (const property of standardGenerateElementProperties({
      logicalId: restControllerServesAppComponentLogicalId(
        controller.id,
        record.contractId,
        record.consumerModuleId,
      ),
      generatorCoordinate: GENERATOR_COORDINATE,
      slot: "rest-controller-serves-app-component",
      basis: record.basis,
      confidence: record.confidence,
    })) {
      builder = builder.property(property.key, property.value);
    }

    relations.push(builder.build().toCreateIntent());
    emittedRelationIds.add(relationId);
  }
}
