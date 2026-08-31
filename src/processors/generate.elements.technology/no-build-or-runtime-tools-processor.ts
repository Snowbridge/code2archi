import type { ArchiCreateIntents } from "../../archimate-model/archi-create-intents.js";
import {
  SystemSoftware,
  type ArchiElementCreateIntent,
} from "../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../archimate-model/folders/archi-folder.js";
import { AssignmentRelationship } from "../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../archimate-model/relationships/archi-relationship.js";
import type { ApplicationModuleRecord } from "../../discovery-model/entities/application-module.js";
import { standardGenerateElementProperties } from "../../generate/archi-element-properties.js";
import { ensureChildFolder } from "../../generate/archi-folder-path.js";
import {
  assignmentLogicalId,
  assignmentRelationshipId,
  isEligibleApplicationModule,
  systemSoftwareSlotForField,
  versionFieldSpec,
} from "../../generate/module-version-catalog.js";
import { collectUnknownVersionMarkers } from "../../generate/unknown-version-markers.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../platform/processors/processor.js";
import { BUILD_TOOLS_AND_RUNTIMES_FOLDER } from "./modules-build-systems-and-runtimes-processor.js";

const GENERATOR_COORDINATE = "generate.elements.technology:no-build-or-runtime-tools";

export class NoBuildOrRuntimeToolsProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.technology",
    artifactId: "no-build-or-runtime-tools",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Marks ApplicationModules with unknown build-tool or runtime version fields via shared SystemSoftware and Assignment links.";

  protected doProcess(input: GenerateProcessorInput): ArchiCreateIntents {
    const pendingFolders = new Map<string, ArchiFolderCreateIntent>();
    const folderIntents: ArchiFolderCreateIntent[] = [];
    const elements: ArchiElementCreateIntent[] = [];
    const relations: ArchiRelationshipCreateIntent[] = [];

    const modules = [...input.discovery.listEntities("ApplicationModule")]
      .filter(isEligibleApplicationModule)
      .map((record) => record as unknown as ApplicationModuleRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const markers = collectUnknownVersionMarkers(modules);
    if (markers.catalog.size === 0 && markers.assignments.length === 0) {
      return {};
    }

    const technologyFolderId = input.archi.getPredefinedFolderId("technology");
    const buildToolsFolder = ensureChildFolder(
      input.archi,
      technologyFolderId,
      BUILD_TOOLS_AND_RUNTIMES_FOLDER,
      pendingFolders,
    );
    if (buildToolsFolder.folderIntent) {
      folderIntents.push(buildToolsFolder.folderIntent);
    }

    const catalogEntries = [...markers.catalog.values()].sort((left, right) =>
      left.systemSoftwareId.localeCompare(right.systemSoftwareId),
    );

    for (const entry of catalogEntries) {
      if (input.archi.getElement(entry.systemSoftwareId)) {
        continue;
      }

      let elementBuilder = SystemSoftware.withId(entry.systemSoftwareId)
        .name(entry.displayName)
        .inFolder(buildToolsFolder.folderId);

      for (const property of standardGenerateElementProperties({
        logicalId: entry.systemSoftwareId,
        generatorCoordinate: GENERATOR_COORDINATE,
        slot: systemSoftwareSlotForField(entry.field),
        confidence: "unknown",
      })) {
        elementBuilder = elementBuilder.property(property.key, property.value);
      }

      elements.push(elementBuilder.build().toCreateIntent());
    }

    for (const assignment of markers.assignments) {
      if (input.archi.getElement(assignment.moduleId) === undefined) {
        continue;
      }

      const relationId = assignmentRelationshipId(
        assignment.catalogEntry.systemSoftwareId,
        assignment.moduleId,
      );
      if (input.archi.getRelationship(relationId)) {
        continue;
      }

      const spec = versionFieldSpec(assignment.field);
      let relationBuilder = AssignmentRelationship.withId(relationId)
        .source(assignment.catalogEntry.systemSoftwareId)
        .target(assignment.moduleId)
        .profiles(spec.assignmentProfile.id);

      for (const property of standardGenerateElementProperties({
        logicalId: assignmentLogicalId(
          assignment.field,
          assignment.catalogEntry.systemSoftwareId,
          assignment.moduleId,
        ),
        generatorCoordinate: GENERATOR_COORDINATE,
        slot: "syssoft-assign",
        confidence: "unknown",
      })) {
        relationBuilder = relationBuilder.property(property.key, property.value);
      }

      relations.push(relationBuilder.build().toCreateIntent());
    }

    return {
      ...(folderIntents.length > 0 ? { folders: folderIntents } : {}),
      ...(elements.length > 0 ? { elements } : {}),
      ...(relations.length > 0 ? { relations } : {}),
    };
  }
}
