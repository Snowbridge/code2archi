import type { ArchiCreateIntents } from "../../../../archimate-model/archi-create-intents.js";
import { computeArchiId } from "../../../../archimate-model/archi-id.js";
import type { ArchiDiagramConnection, ArchiDiagramObject } from "../../../../archimate-model/diagrams/archi-diagram-content.js";
import { ArchimateDiagramModel } from "../../../../archimate-model/elements/archi-element.js";
import type { ArchiElementCreateIntent } from "../../../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../../../archimate-model/folders/archi-folder.js";
import { ArchiFolderIds } from "../../../../archimate-model/folders/archi-folder.js";
import type { ArchiRelationshipCreateIntent } from "../../../../archimate-model/relationships/archi-relationship.js";
import type { ApplicationModuleRecord } from "../../../../code-inventory/entities/application-module.js";
import type { ApplicationModuleDependencyRecord } from "../../../../code-inventory/entities/application-module-dependency.js";
import {
  applicationComponentIdForModule,
  buildModulesByCoordinates,
  buildModulesByRepositoryAndCoordinates,
  resolveModuleForDependency,
} from "../../../../generate/application-module-components.js";
import { standardGenerateViewProperties } from "../../../../generate/archi-element-properties.js";
import {
  buildBuildTimeDependencyAdjacency,
  dedupeAndSortCanonicalCycles,
  enumerateElementaryCycles,
  hasEdge,
  participantModuleIdsFromCanonicalCycle,
  type BuildTimeDependencyAdjacency,
  type CanonicalCycle,
} from "../../../../generate/module-build-dependency-graph.js";
import { isEligibleApplicationModule } from "../../../../generate/module-version-catalog.js";
import type { DiscoveryEntityRecord } from "../../../../code-inventory/entities/entity-types.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../../../platform/processors/processor.js";

const GENERATOR_COORDINATE = "generate.views.application:cyclical-dependencies";
const CYCLICAL_DEPENDENCIES_FOLDER_NAME = "Cyclical dependencies";
const DIAGRAM_VIEWPOINT = "Application Layer";
const DIAGRAM_GRID_COLS = 8;
const DIAGRAM_GRID_STEP_X = 160;
const DIAGRAM_GRID_STEP_Y = 80;
const DIAGRAM_GRID_ORIGIN_X = 20;
const DIAGRAM_GRID_ORIGIN_Y = 20;
const DIAGRAM_NODE_WIDTH = 140;
const DIAGRAM_NODE_HEIGHT = 55;
const MODULE_LIB_AGGREGATION_SLOT = "module-lib-aggregation";

export class CyclicalDependenciesProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.views.application",
    artifactId: "cyclical-dependencies",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Creates Application Layer diagrams for elementary Maven and Gradle module dependency cycles.";

  protected doProcess(input: GenerateProcessorInput): ArchiCreateIntents {
    const folders: ArchiFolderCreateIntent[] = [];
    const elements: ArchiElementCreateIntent[] = [];

    const diagramsRootFolderId = input.archi.getPredefinedFolderId("diagrams");
    const cyclicalFolderId = ArchiFolderIds.nestedId(
      diagramsRootFolderId,
      CYCLICAL_DEPENDENCIES_FOLDER_NAME,
    );

    if (input.archi.getFolder(cyclicalFolderId) === undefined) {
      folders.push({
        id: cyclicalFolderId,
        name: CYCLICAL_DEPENDENCIES_FOLDER_NAME,
        parentFolderId: diagramsRootFolderId,
      });
    }

    const adjacency = buildBuildTimeDependencyAdjacency(input.discovery);
    if (adjacency.size === 0) {
      return this.buildOutput(folders, elements);
    }

    const rawCycles = enumerateElementaryCycles(adjacency);
    if (rawCycles.length === 0) {
      return this.buildOutput(folders, elements);
    }

    const canonicalCycles = dedupeAndSortCanonicalCycles(rawCycles);
    const modulesById = this.buildModulesById(input);
    const dependencyIndex = this.buildDependencyIndex(input, adjacency);

    for (const cycle of canonicalCycles) {
      const diagram = this.buildDiagramForCycle(
        input,
        cycle,
        cyclicalFolderId,
        adjacency,
        modulesById,
        dependencyIndex,
      );
      if (diagram !== undefined) {
        elements.push(diagram);
      }
    }

    return this.buildOutput(folders, elements);
  }

  private buildOutput(
    folders: ArchiFolderCreateIntent[],
    elements: ArchiElementCreateIntent[],
  ): ArchiCreateIntents {
    return {
      ...(folders.length > 0 ? { folders } : {}),
      ...(elements.length > 0 ? { elements } : {}),
    };
  }

  private buildModulesById(input: GenerateProcessorInput): ReadonlyMap<string, ApplicationModuleRecord> {
    const modulesById = new Map<string, ApplicationModuleRecord>();
    for (const record of input.discovery.listEntities("ApplicationModule")) {
      modulesById.set(record.id, record as unknown as ApplicationModuleRecord);
    }
    return modulesById;
  }

  private buildDependencyIndex(
    input: GenerateProcessorInput,
    adjacency: BuildTimeDependencyAdjacency,
  ): ReadonlyMap<string, readonly ApplicationModuleDependencyRecord[]> {
    const allModules = [...input.discovery.listEntities("ApplicationModule")].map(
      (record) => record as unknown as ApplicationModuleRecord,
    );
    const coordinateIndex = buildModulesByRepositoryAndCoordinates(allModules);
    const modulesByCoordinate = buildModulesByCoordinates(allModules);
    const edgeDependencies = new Map<string, ApplicationModuleDependencyRecord[]>();

    const dependencies = [...input.discovery.listEntities("ApplicationModuleDependency")]
      .map((record) => record as unknown as ApplicationModuleDependencyRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    for (const dependency of dependencies) {
      const consumer = allModules.find((module) => module.id === dependency.parentId);
      if (
        consumer === undefined ||
        !isEligibleApplicationModule(consumer as unknown as DiscoveryEntityRecord)
      ) {
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

      if (!hasEdge(adjacency, consumer.id, targetModule.id)) {
        continue;
      }

      const edgeKey = `${consumer.id}\u0000${targetModule.id}`;
      const matches = edgeDependencies.get(edgeKey);
      if (matches === undefined) {
        edgeDependencies.set(edgeKey, [dependency]);
      } else {
        matches.push(dependency);
      }
    }

    return edgeDependencies;
  }

  private buildDiagramForCycle(
    input: GenerateProcessorInput,
    cycle: CanonicalCycle,
    cyclicalFolderId: string,
    adjacency: BuildTimeDependencyAdjacency,
    modulesById: ReadonlyMap<string, ApplicationModuleRecord>,
    dependencyIndex: ReadonlyMap<string, readonly ApplicationModuleDependencyRecord[]>,
  ): ArchiElementCreateIntent | undefined {
    const participantModuleIds = participantModuleIdsFromCanonicalCycle(cycle.canonicalIds);
    const participantComponentIds = new Set<string>();
    for (const moduleId of participantModuleIds) {
      participantComponentIds.add(applicationComponentIdForModule(moduleId));
    }

    const aggregations = this.collectModuleLibAggregations(input, participantComponentIds);
    const diagramId = cyclicalDependencyDiagramId(cycle.canonicalCycleKey);

    if (input.archi.getElement(diagramId) !== undefined) {
      return undefined;
    }

    const layoutModuleIds = [...participantModuleIds].sort((left, right) =>
      left.localeCompare(right),
    );
    const diagramObjectsByComponentId = new Map<string, ArchiDiagramObject>();

    for (let index = 0; index < layoutModuleIds.length; index++) {
      const moduleId = layoutModuleIds[index];
      const applicationComponentId = applicationComponentIdForModule(moduleId);
      const element = input.archi.getElement(applicationComponentId);
      if (element === undefined) {
        this.logger.warn("cyclical dependency diagram: missing ApplicationComponent for module", {
          moduleId,
          diagramId,
          canonicalCycleKey: cycle.canonicalCycleKey,
        });
        continue;
      }

      diagramObjectsByComponentId.set(applicationComponentId, {
        id: diagramObjectId(diagramId, applicationComponentId),
        archimateElement: applicationComponentId,
        bounds: {
          x: DIAGRAM_GRID_ORIGIN_X + (index % DIAGRAM_GRID_COLS) * DIAGRAM_GRID_STEP_X,
          y: DIAGRAM_GRID_ORIGIN_Y + Math.floor(index / DIAGRAM_GRID_COLS) * DIAGRAM_GRID_STEP_Y,
          width: DIAGRAM_NODE_WIDTH,
          height: DIAGRAM_NODE_HEIGHT,
        },
        textPosition: "1",
        sourceConnections: [],
        targetConnectionIds: [],
      });
    }

    if (diagramObjectsByComponentId.size === 0) {
      return undefined;
    }

    this.warnMissingAggregationsForCycle(
      participantModuleIds,
      adjacency,
      dependencyIndex,
      input,
      cycle.canonicalCycleKey,
    );

    const connectionsBySourceObjectId = new Map<string, ArchiDiagramConnection[]>();
    const targetConnectionIdsByObjectId = new Map<string, string[]>();

    for (const relation of aggregations) {
      const sourceObject = diagramObjectsByComponentId.get(relation.sourceId);
      const targetObject = diagramObjectsByComponentId.get(relation.targetId);
      if (sourceObject === undefined || targetObject === undefined) {
        continue;
      }

      const connection: ArchiDiagramConnection = {
        id: diagramConnectionId(diagramId, relation.id),
        source: sourceObject.id,
        target: targetObject.id,
        archimateRelationship: relation.id,
      };

      const sourceConnections = connectionsBySourceObjectId.get(sourceObject.id);
      if (sourceConnections === undefined) {
        connectionsBySourceObjectId.set(sourceObject.id, [connection]);
      } else {
        sourceConnections.push(connection);
      }

      const targetConnections = targetConnectionIdsByObjectId.get(targetObject.id);
      if (targetConnections === undefined) {
        targetConnectionIdsByObjectId.set(targetObject.id, [connection.id]);
      } else {
        targetConnections.push(connection.id);
      }
    }

    const diagramObjects: ArchiDiagramObject[] = [];
    for (const moduleId of layoutModuleIds) {
      const applicationComponentId = applicationComponentIdForModule(moduleId);
      const baseObject = diagramObjectsByComponentId.get(applicationComponentId);
      if (baseObject === undefined) {
        continue;
      }
      diagramObjects.push({
        ...baseObject,
        sourceConnections: connectionsBySourceObjectId.get(baseObject.id) ?? [],
        targetConnectionIds: targetConnectionIdsByObjectId.get(baseObject.id) ?? [],
      });
    }

    const diagramName = this.buildDiagramName(input, cycle, modulesById);
    let diagramBuilder = ArchimateDiagramModel.withId(diagramId)
      .name(diagramName)
      .inFolder(cyclicalFolderId)
      .viewpoint(DIAGRAM_VIEWPOINT);

    for (const property of standardGenerateViewProperties({
      logicalId: cyclicalDependencyLogicalId(cycle.canonicalCycleKey),
      generatorCoordinate: GENERATOR_COORDINATE,
    })) {
      diagramBuilder = diagramBuilder.property(property.key, property.value);
    }

    for (const diagramObject of diagramObjects) {
      diagramBuilder = diagramBuilder.diagramObject(diagramObject);
    }

    return diagramBuilder.build().toCreateIntent();
  }

  private buildDiagramName(
    input: GenerateProcessorInput,
    cycle: CanonicalCycle,
    modulesById: ReadonlyMap<string, ApplicationModuleRecord>,
  ): string {
    const segments: string[] = [];
    for (const moduleId of cycle.canonicalIds) {
      const applicationComponentId = applicationComponentIdForModule(moduleId);
      const element = input.archi.getElement(applicationComponentId);
      if (element !== undefined) {
        segments.push(element.name);
        continue;
      }
      segments.push(moduleId);
    }
    return `Cycle:${segments.join(" → ")}`;
  }

  private collectModuleLibAggregations(
    input: GenerateProcessorInput,
    participantComponentIds: ReadonlySet<string>,
  ): readonly ArchiRelationshipCreateIntent[] {
    const matches: ArchiRelationshipCreateIntent[] = [];
    for (const relation of input.archi.listRelations()) {
      if (!participantComponentIds.has(relation.sourceId)) {
        continue;
      }
      if (!participantComponentIds.has(relation.targetId)) {
        continue;
      }
      const slot = relation.properties?.find((property) => property.key === "c2a:slot")?.value;
      if (slot !== MODULE_LIB_AGGREGATION_SLOT) {
        continue;
      }
      matches.push(relation);
    }
    return matches.sort((left, right) => left.id.localeCompare(right.id));
  }

  private warnMissingAggregationsForCycle(
    participantModuleIds: ReadonlySet<string>,
    adjacency: BuildTimeDependencyAdjacency,
    dependencyIndex: ReadonlyMap<string, readonly ApplicationModuleDependencyRecord[]>,
    input: GenerateProcessorInput,
    canonicalCycleKey: string,
  ): void {
    const warnedPairs = new Set<string>();

    for (const consumerId of participantModuleIds) {
      for (const libId of adjacency.get(consumerId) ?? []) {
        if (!participantModuleIds.has(libId)) {
          continue;
        }

        const pairKey = `${consumerId}\u0000${libId}`;
        if (warnedPairs.has(pairKey)) {
          continue;
        }
        warnedPairs.add(pairKey);

        const consumerComponentId = applicationComponentIdForModule(consumerId);
        const libComponentId = applicationComponentIdForModule(libId);
        const hasAggregation = input.archi.listRelations().some((relation) => {
          if (relation.sourceId !== consumerComponentId || relation.targetId !== libComponentId) {
            return false;
          }
          const slot = relation.properties?.find((property) => property.key === "c2a:slot")?.value;
          return slot === MODULE_LIB_AGGREGATION_SLOT;
        });

        if (hasAggregation) {
          continue;
        }

        this.logger.warn("cyclical dependency diagram: missing module-lib-aggregation for graph edge", {
          consumerModuleId: consumerId,
          libraryModuleId: libId,
          canonicalCycleKey,
          dependencyIds: (dependencyIndex.get(pairKey) ?? []).map((dependency) => dependency.id),
        });
      }
    }
  }
}

export function cyclicalDependencyDiagramId(canonicalCycleKey: string): string {
  return computeArchiId("ArchimateDiagramModel", "cyclical-dependency", canonicalCycleKey);
}

export function cyclicalDependencyLogicalId(canonicalCycleKey: string): string {
  return `view:cyclical-dependency:${canonicalCycleKey}`;
}

export function diagramObjectId(diagramId: string, applicationComponentId: string): string {
  return computeArchiId("DiagramObject", diagramId, applicationComponentId);
}

export function diagramConnectionId(diagramId: string, relationshipId: string): string {
  return computeArchiId("Connection", diagramId, relationshipId);
}
