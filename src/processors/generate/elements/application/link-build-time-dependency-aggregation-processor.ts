import type { ArchiCreateIntents } from "../../../../archimate-model/archi-create-intents.js";
import type { ArchiProfile } from "../../../../archimate-model/profiles/profile.js";
import { BuildTimeDependencyProfile } from "../../../../archimate-model/profiles/profile.js";
import { AggregationRelationship } from "../../../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../../../archimate-model/relationships/archi-relationship.js";
import {
  aggregationLogicalId,
  aggregationRelationshipId,
  applicationComponentIdForModule,
  buildModulesByCoordinates,
  buildModulesByRepositoryAndCoordinates,
  resolveModuleForDependency,
} from "../../../../generate/application-module-components.js";
import { standardGenerateElementProperties } from "../../../../generate/archi-element-properties.js";
import { isEligibleApplicationModule } from "../../../../generate/module-version-catalog.js";
import type { ApplicationModuleRecord } from "../../../../code-inventory/entities/application-module.js";
import type { ApplicationModuleDependencyRecord } from "../../../../code-inventory/entities/application-module-dependency.js";
import type { DiscoveryEntityRecord } from "../../../../code-inventory/entities/entity-types.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../../../platform/processors/processor.js";

const GENERATOR_COORDINATE =
  "generate.elements.application:link-build-time-dependency-aggregation";

const REQUIRED_PROFILES: readonly ArchiProfile[] = [BuildTimeDependencyProfile.create()];

export class LinkBuildTimeDependencyAggregationProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.application",
    artifactId: "link-build-time-dependency-aggregation",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ON_DEMAND" as const;

  readonly description =
    "Creates build-time dependency aggregations between application module components from ApplicationModuleDependency records.";

  protected doProcess(input: GenerateProcessorInput): ArchiCreateIntents {
    const relations: ArchiRelationshipCreateIntent[] = [];

    const profiles = REQUIRED_PROFILES.filter(
      (profile) =>
        input.archi.findProfile(profile.name, profile.conceptType) === undefined,
    );

    const allModules = [...input.discovery.listEntities("ApplicationModule")].map(
      (record) => record as unknown as ApplicationModuleRecord,
    );
    const modules = allModules
      .filter((record) => isEligibleApplicationModule(record as unknown as DiscoveryEntityRecord))
      .sort((left, right) => left.id.localeCompare(right.id));

    const modulesById = new Map(modules.map((module) => [module.id, module]));
    const coordinateIndex = buildModulesByRepositoryAndCoordinates(allModules);
    const modulesByCoordinate = buildModulesByCoordinates(allModules);

    const dependencies = [...input.discovery.listEntities("ApplicationModuleDependency")]
      .map((record) => record as unknown as ApplicationModuleDependencyRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    for (const dependency of dependencies) {
      const consumer = modulesById.get(dependency.parentId);
      if (consumer === undefined) {
        continue;
      }

      const targetModule = resolveModuleForDependency(
        coordinateIndex,
        modulesByCoordinate,
        consumer,
        dependency.groupId,
        dependency.artifactId,
      );
      if (
        targetModule === undefined ||
        !isEligibleApplicationModule(targetModule as unknown as DiscoveryEntityRecord)
      ) {
        continue;
      }

      const consumerApplicationComponentId = applicationComponentIdForModule(consumer.id);
      const libraryApplicationComponentId = applicationComponentIdForModule(targetModule.id);
      const relationId = aggregationRelationshipId(
        consumerApplicationComponentId,
        libraryApplicationComponentId,
        dependency.id,
      );
      if (input.archi.getRelationship(relationId)) {
        continue;
      }

      const buildTimeDependencyProfile = BuildTimeDependencyProfile.create();
      let aggregationBuilder = AggregationRelationship.withId(relationId)
        .source(consumerApplicationComponentId)
        .target(libraryApplicationComponentId)
        .profiles(buildTimeDependencyProfile.id)
        .property("c2a:libraryVersion", String(dependency.version));

      for (const property of standardGenerateElementProperties({
        logicalId: aggregationLogicalId(dependency.id),
        generatorCoordinate: GENERATOR_COORDINATE,
        slot: "module-lib-aggregation",
      })) {
        aggregationBuilder = aggregationBuilder.property(property.key, property.value);
      }

      relations.push(aggregationBuilder.build().toCreateIntent());
    }

    return {
      ...(profiles.length > 0 ? { profiles } : {}),
      ...(relations.length > 0 ? { relations } : {}),
    };
  }
}
