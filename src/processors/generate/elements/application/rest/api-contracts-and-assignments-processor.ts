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
import type { ApplicationModuleRecord } from "../../../../../code-inventory/entities/application-module.js";
import type { DiscoveryEntityRecord } from "../../../../../code-inventory/entities/entity-types.js";
import type { HttpServerApiRecord } from "../../../../../code-inventory/entities/http-server-api.js";
import type { HttpClientToServerApiLinkRecord } from "../../../../../code-inventory/links/http-client-to-server-api-link.js";
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
  selectBestHttpClientToServerApiLinksPerClient,
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
    "Creates REST API contract ApplicationInterfaces per HttpServerApi and assigns them to servers and matched clients.";

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

    const servers = [...input.discovery.listEntities("HttpServerApi")]
      .map((record) => record as unknown as HttpServerApiRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const applicationFolderId = input.archi.getPredefinedFolderId("application");
    const contractProfile = RestApiContractProfile.create();

    for (const server of servers) {
      const module = modulesById.get(server.applicationModuleId);
      if (module === undefined) {
        continue;
      }

      const contractId = restApiContractElementId(module.id, server.symbolKey);
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
              String(server.name),
              {},
              input.options,
            ),
          )
          .inFolder(targetFolder.folderId)
          .profiles(contractProfile.id);

        const documentation = buildRestApiContractDocumentation({
          endpoints: server.endpoints,
          payloadTypes: server.payloadTypes,
          contractTypes: server.contractTypes,
        });
        if (documentation !== undefined) {
          elementBuilder = elementBuilder.documentation(documentation);
        }

        for (const property of standardGenerateElementProperties({
          logicalId: restApiContractLogicalId(module.id, server.symbolKey),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "rest-api-contract",
        })) {
          elementBuilder = elementBuilder.property(property.key, property.value);
        }

        const elementIntent = withEntityDebugProperties(elementBuilder.build().toCreateIntent(), [
          {
            entityType: "HttpServerApi",
            record: server as unknown as DiscoveryEntityRecord,
          },
        ]);
        elements.push(elementIntent);
      }

      const serverAssignmentId = restApiContractAssignmentRelationshipId(contractId, server.id);
      if (!input.archi.getRelationship(serverAssignmentId)) {
        let assignmentBuilder = AssignmentRelationship.withId(serverAssignmentId)
          .source(contractId)
          .target(server.id);

        for (const property of standardGenerateElementProperties({
          logicalId: restApiContractAssignmentLogicalId(
            module.id,
            server.symbolKey,
            "restcontroller",
            server.id,
          ),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "rest-api-contract-assignment",
        })) {
          assignmentBuilder = assignmentBuilder.property(property.key, property.value);
        }

        relations.push(assignmentBuilder.build().toCreateIntent());
      }
    }

    const serverSymbolKeyById = new Map(
      servers.map((server) => {
        const module = modulesById.get(server.applicationModuleId);
        return [
          server.id,
          module === undefined ? undefined : { moduleId: module.id, symbolKey: server.symbolKey },
        ] as const;
      }),
    );

    const links = input.discovery
      .listLinks("HttpClientToServerApiLink")
      .map((record) => record as unknown as HttpClientToServerApiLinkRecord)
      .map((record) => ({
        id: record.id,
        httpServerApiId: record.httpServerApiId,
        httpClientApiId: record.httpClientApiId,
        sourceApplicationModuleId: record.sourceApplicationModuleId,
        targetApplicationModuleId: record.targetApplicationModuleId,
        matchMethod: record.matchMethod,
        basis: record.basis,
        confidence: record.confidence,
      }));

    for (const link of selectBestHttpClientToServerApiLinksPerClient(links)) {
      const serverMeta = serverSymbolKeyById.get(link.httpServerApiId);
      if (serverMeta === undefined) {
        continue;
      }

      const contractId = restApiContractElementId(serverMeta.moduleId, serverMeta.symbolKey);
      const assignmentId = restApiContractAssignmentRelationshipId(contractId, link.httpClientApiId);
      if (input.archi.getRelationship(assignmentId)) {
        continue;
      }

      let assignmentBuilder = AssignmentRelationship.withId(assignmentId)
        .source(contractId)
        .target(link.httpClientApiId);

      for (const property of standardGenerateElementProperties({
        logicalId: restApiContractAssignmentLogicalId(
          serverMeta.moduleId,
          serverMeta.symbolKey,
          "restclient",
          link.httpClientApiId,
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
