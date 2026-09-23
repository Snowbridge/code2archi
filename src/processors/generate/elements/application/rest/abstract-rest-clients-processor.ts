import type { ArchiCreateIntents } from "../../../../../archimate-model/archi-create-intents.js";
import {
  ApplicationService,
  type ArchiElementCreateIntent,
} from "../../../../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../../../../archimate-model/folders/archi-folder.js";
import type { ArchiProfile } from "../../../../../archimate-model/profiles/profile.js";
import {
  ProvidesRestClientProfile,
  RestClientProfile,
} from "../../../../../archimate-model/profiles/profile.js";
import {
  AggregationRelationship,
  RealizationRelationship,
} from "../../../../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../../../../archimate-model/relationships/archi-relationship.js";
import {
  applicationComponentIdForModule,
  buildModulesByCoordinates,
  buildModulesByRepositoryAndCoordinates,
  collectLibraryModuleIds,
  resolveModuleForDependency,
  type ModulesByCoordinates,
  type ModulesByRepositoryAndCoordinates,
} from "../../../../../generate/application-module-components.js";
import { standardGenerateElementProperties } from "../../../../../generate/archi-element-properties.js";
import {
  dedupeAndSortFolderIntents,
  ensureFolderPath,
  repositoryFolderSegments,
} from "../../../../../generate/archi-folder-path.js";
import { withEntityDebugProperties } from "../../../../../generate/generate-debug.js";
import { isEligibleApplicationModule } from "../../../../../generate/module-version-catalog.js";
import {
  appModuleRealizesRestClientId,
  appModuleRealizesRestClientLogicalId,
  libRestClientAggregationId,
  libRestClientAggregationLogicalId,
  restClientAppServiceId,
  restClientAppServiceLogicalId,
} from "../../../../../generate/rest-controller-elements.js";
import type { ApplicationModuleRecord } from "../../../../../code-inventory/entities/application-module.js";
import type { ApplicationModuleDependencyRecord } from "../../../../../code-inventory/entities/application-module-dependency.js";
import type { DiscoveryEntityRecord } from "../../../../../code-inventory/entities/entity-types.js";
import type { RestClientRecord } from "../../../../../code-inventory/entities/rest-client.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
} from "../../../../../platform/processors/processor.js";

/**
 * Resolution context for slot:lib-rest-client-aggregated-into-app-component
 * (Library module clients only).
 */
interface LibConsumerAggregationContext {
  readonly dependencies: readonly ApplicationModuleDependencyRecord[];
  readonly modulesById: ReadonlyMap<string, ApplicationModuleRecord>;
  readonly coordinateIndex: ModulesByRepositoryAndCoordinates;
  readonly modulesByCoordinate: ModulesByCoordinates;
  readonly emittedClientConsumerPairs: Set<string>;
  readonly generatorCoordinate: string;
}

/**
 * Shared mapping of RestClient entities to slot:rest-client-app-service and
 * slot:app-module-realizes-rest-client. Concrete subclasses select clients by
 * module kind (Library module vs app component) — see
 * documentation/specifications/cli/generate/processors/generate/elements/application/rest/lib-module-clients.md.
 */
export abstract class AbstractRestClientsProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  /** true — process clients of Library modules; false — clients of non-library modules. */
  protected abstract readonly includeLibraryModules: boolean;

  protected doProcess(input: GenerateProcessorInput): ArchiCreateIntents {
    const pendingFolders = new Map<string, ArchiFolderCreateIntent>();
    const folderIntents: ArchiFolderCreateIntent[] = [];
    const elements: ArchiElementCreateIntent[] = [];
    const relations: ArchiRelationshipCreateIntent[] = [];

    const requiredProfiles: ArchiProfile[] = this.includeLibraryModules
      ? [RestClientProfile.create(), ProvidesRestClientProfile.create()]
      : [RestClientProfile.create()];
    const profiles = requiredProfiles.filter(
      (profile: ArchiProfile) =>
        input.archi.findProfile(profile.name, profile.conceptType) === undefined,
    );

    const repositoriesById = new Map(
      input.discovery.listEntities("Repository").map((repository) => [repository.id, repository]),
    );

    const allModules = [...input.discovery.listEntities("ApplicationModule")].map(
      (record) => record as unknown as ApplicationModuleRecord,
    );
    const modulesById = new Map(allModules.map((module) => [module.id, module]));

    const dependencies = [...input.discovery.listEntities("ApplicationModuleDependency")]
      .map((record) => record as unknown as ApplicationModuleDependencyRecord)
      .sort((left, right) => left.id.localeCompare(right.id));
    const libraryModuleIds = collectLibraryModuleIds(dependencies, allModules);

    const clients = [...input.discovery.listEntities("RestClient")]
      .map((record) => record as unknown as RestClientRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const applicationFolderId = input.archi.getPredefinedFolderId("application");
    const generatorCoordinate = `${this.id.groupId}:${this.id.artifactId}`;

    const aggregationContext: LibConsumerAggregationContext | undefined = this
      .includeLibraryModules
      ? {
          dependencies,
          modulesById,
          coordinateIndex: buildModulesByRepositoryAndCoordinates(allModules),
          modulesByCoordinate: buildModulesByCoordinates(allModules),
          emittedClientConsumerPairs: new Set<string>(),
          generatorCoordinate,
        }
      : undefined;

    for (const client of clients) {
      const module = modulesById.get(client.applicationModuleId);
      if (module === undefined) {
        continue;
      }

      if (libraryModuleIds.has(module.id) !== this.includeLibraryModules) {
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
          generatorCoordinate,
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
          generatorCoordinate,
          slot: "app-module-realizes-rest-client",
        })) {
          realizationBuilder = realizationBuilder.property(property.key, property.value);
        }

        relations.push(realizationBuilder.build().toCreateIntent());
      }

      if (aggregationContext !== undefined && client.origin !== "supplement") {
        this.appendConsumerAggregations(
          input,
          aggregationContext,
          client,
          module,
          serviceId,
          relations,
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

  /**
   * Creates slot:lib-rest-client-aggregated-into-app-component: for each
   * eligible consumer module whose ApplicationModuleDependency resolves to the
   * client's Library module — one aggregation per (client, consumer) pair.
   */
  private appendConsumerAggregations(
    input: GenerateProcessorInput,
    context: LibConsumerAggregationContext,
    client: RestClientRecord,
    libModule: ApplicationModuleRecord,
    serviceId: string,
    relations: ArchiRelationshipCreateIntent[],
  ): void {
    for (const dependency of context.dependencies) {
      const consumer = context.modulesById.get(dependency.parentId);
      if (
        consumer === undefined ||
        !isEligibleApplicationModule(consumer as unknown as DiscoveryEntityRecord)
      ) {
        continue;
      }

      const resolvedLibModule = resolveModuleForDependency(
        context.coordinateIndex,
        context.modulesByCoordinate,
        consumer,
        dependency.groupId,
        dependency.artifactId,
      );
      if (resolvedLibModule === undefined || resolvedLibModule.id !== libModule.id) {
        continue;
      }

      const pairKey = `${client.id}::${consumer.id}`;
      if (context.emittedClientConsumerPairs.has(pairKey)) {
        continue;
      }
      context.emittedClientConsumerPairs.add(pairKey);

      const relationId = libRestClientAggregationId(consumer.id, client.id);
      if (input.archi.getRelationship(relationId) !== undefined) {
        continue;
      }

      let aggregationBuilder = AggregationRelationship.withId(relationId)
        .source(applicationComponentIdForModule(consumer.id))
        .target(serviceId)
        .profiles(ProvidesRestClientProfile.create().id);

      for (const property of standardGenerateElementProperties({
        logicalId: libRestClientAggregationLogicalId(consumer.id, client.id),
        generatorCoordinate: context.generatorCoordinate,
        slot: "lib-rest-client-aggregated-into-app-component",
      })) {
        aggregationBuilder = aggregationBuilder.property(property.key, property.value);
      }

      relations.push(aggregationBuilder.build().toCreateIntent());
    }
  }
}
