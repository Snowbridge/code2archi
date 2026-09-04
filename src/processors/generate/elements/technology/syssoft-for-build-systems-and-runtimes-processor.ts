import type { ArchiCreateIntents } from "../../../../archimate-model/archi-create-intents.js";
import {
  Artifact,
  SystemSoftware,
  type ArchiElementCreateIntent,
} from "../../../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../../../archimate-model/folders/archi-folder.js";
import type { ArchiProfile } from "../../../../archimate-model/profiles/profile.js";
import {
  BuiltWithProfile,
  CompiledWithProfile,
  GradleModuleArtifactProfile,
  MavenModuleArtifactProfile,
  NpmModuleArtifactProfile,
  RunsOnProfile,
} from "../../../../archimate-model/profiles/profile.js";
import { AssignmentRelationship, CompositionRelationship } from "../../../../archimate-model/relationships/archi-relationship.js";
import type { ArchiRelationshipCreateIntent } from "../../../../archimate-model/relationships/archi-relationship.js";
import { standardGenerateElementProperties } from "../../../../generate/archi-element-properties.js";
import {
  ensureChildFolder,
  ensureFolderPath,
  repositoryFolderSegments,
  dedupeAndSortFolderIntents,
} from "../../../../generate/archi-folder-path.js";
import { withEntityDebugProperties } from "../../../../generate/generate-debug.js";
import { decorateElementName } from "../../../../generate/element-name-decoration.js";
import { moduleArtifactRepoPathValue } from "../../../../generate/module-artifact-repo-path.js";
import {
  assignmentLogicalId,
  assignmentRelationshipId,
  collectSystemSoftwareCatalog,
  isEligibleApplicationModule,
  moduleArtifactProfileFor,
  repositoryModuleCompositionLogicalId,
  repositoryModuleCompositionRelationshipId,
  systemSoftwareSlotForField,
  versionFieldSpec,
} from "../../../../generate/module-version-catalog.js";
import type { ApplicationModuleRecord } from "../../../../discovery-model/entities/application-module.js";
import type { DiscoveryEntityRecord } from "../../../../discovery-model/entities/entity-types.js";
import {
  MODULE_VERSION_FIELDS,
  type ModuleVersionField,
} from "../../../../parsers/build-tool-versions.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../../../platform/processors/processor.js";

export const APPLICATION_MODULES_FOLDER = "Application modules";
export const BUILD_TOOLS_AND_RUNTIMES_FOLDER = "Build tools and runtimes";

const GENERATOR_COORDINATE =
  "generate.elements.technology:syssoft-for-build-systems-and-runtimes";

const REQUIRED_PROFILES: readonly ArchiProfile[] = [
  MavenModuleArtifactProfile.create(),
  GradleModuleArtifactProfile.create(),
  NpmModuleArtifactProfile.create(),
  RunsOnProfile.create(),
  BuiltWithProfile.create(),
  CompiledWithProfile.create(),
];

export class SyssoftForBuildSystemsAndRuntimesProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.technology",
    artifactId: "syssoft-for-build-systems-and-runtimes",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Maps ApplicationModule entities to Technology Artifacts, SystemSoftware toolchain/runtime catalog, Composition repo-to-module links, and Assignment relationships.";

  protected doProcess(input: GenerateProcessorInput): ArchiCreateIntents {
    const pendingFolders = new Map<string, ArchiFolderCreateIntent>();
    const folderIntents: ArchiFolderCreateIntent[] = [];
    const elements: ArchiElementCreateIntent[] = [];
    const relations: ArchiRelationshipCreateIntent[] = [];

    const technologyFolderId = input.archi.getPredefinedFolderId("technology");
    const applicationModulesFolder = ensureChildFolder(
      input.archi,
      technologyFolderId,
      APPLICATION_MODULES_FOLDER,
      pendingFolders,
    );
    if (applicationModulesFolder.folderIntent) {
      folderIntents.push(applicationModulesFolder.folderIntent);
    }

    const buildToolsFolder = ensureChildFolder(
      input.archi,
      technologyFolderId,
      BUILD_TOOLS_AND_RUNTIMES_FOLDER,
      pendingFolders,
    );
    if (buildToolsFolder.folderIntent) {
      folderIntents.push(buildToolsFolder.folderIntent);
    }

    const profiles = REQUIRED_PROFILES.filter(
      (profile) =>
        input.archi.findProfile(profile.name, profile.conceptType) === undefined,
    );

    const repositoriesById = new Map(
      input.discovery.listEntities("Repository").map((repository) => [repository.id, repository]),
    );

    const modules = [...input.discovery.listEntities("ApplicationModule")]
      .filter(isEligibleApplicationModule)
      .map((record) => record as unknown as ApplicationModuleRecord)
      .sort((left, right) => left.id.localeCompare(right.id));

    const eligibleModuleCountByRepositoryId = new Map<string, number>();
    for (const module of modules) {
      const repositoryId = String(module.repositoryId);
      eligibleModuleCountByRepositoryId.set(
        repositoryId,
        (eligibleModuleCountByRepositoryId.get(repositoryId) ?? 0) + 1,
      );
    }

    for (const module of modules) {
      const repository = repositoriesById.get(String(module.repositoryId));
      const includeRepoName =
        (eligibleModuleCountByRepositoryId.get(String(module.repositoryId)) ?? 0) > 1;
      const folderSegments = repositoryFolderSegments(repository, { includeRepoName });
      const targetFolder = ensureFolderPath(
        input.archi,
        applicationModulesFolder.folderId,
        folderSegments,
        pendingFolders,
      );
      folderIntents.push(...targetFolder.folderIntents);

      if (input.archi.getElement(module.id)) {
        continue;
      }

      const moduleProfile = moduleArtifactProfileFor(
        module.buildSystem as "maven" | "gradle" | "npm",
      );
      let elementBuilder = Artifact.withId(module.id)
        .name(
          decorateElementName(
            "module-artifact",
            String(module.name),
            { buildSystem: module.buildSystem as "maven" | "gradle" | "npm" },
            input.options,
          ),
        )
        .inFolder(targetFolder.folderId)
        .profiles(moduleProfile.id)
        .property(
          "c2a:repo-path",
          moduleArtifactRepoPathValue(
            String(repository?.namespace ?? ""),
            String(repository?.name ?? ""),
            String(module.repoPath),
          ),
        );

      for (const property of standardGenerateElementProperties({
        logicalId: module.id,
        generatorCoordinate: GENERATOR_COORDINATE,
        slot: "module-artifact",
      })) {
        elementBuilder = elementBuilder.property(property.key, property.value);
      }

      const elementIntent = withEntityDebugProperties(elementBuilder.build().toCreateIntent(), [
        {
          entityType: "ApplicationModule",
          record: module as unknown as DiscoveryEntityRecord,
        },
      ]);
      elements.push(elementIntent);
    }

    for (const module of modules) {
      const repositoryId = String(module.repositoryId);
      if (input.archi.getElement(repositoryId) === undefined) {
        continue;
      }

      const compositionId = repositoryModuleCompositionRelationshipId(repositoryId, module.id);
      if (input.archi.getRelationship(compositionId)) {
        continue;
      }

      let compositionBuilder = CompositionRelationship.withId(compositionId)
        .source(repositoryId)
        .target(module.id);

      for (const property of standardGenerateElementProperties({
        logicalId: repositoryModuleCompositionLogicalId(repositoryId, module.id),
        generatorCoordinate: GENERATOR_COORDINATE,
        slot: "repo-module-composition",
      })) {
        compositionBuilder = compositionBuilder.property(property.key, property.value);
      }

      relations.push(compositionBuilder.build().toCreateIntent());
    }

    const catalog = collectSystemSoftwareCatalog(modules);
    const catalogEntries = [...catalog.values()].sort((left, right) =>
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
      })) {
        elementBuilder = elementBuilder.property(property.key, property.value);
      }

      elements.push(elementBuilder.build().toCreateIntent());
    }

    for (const module of modules) {
      for (const field of MODULE_VERSION_FIELDS) {
        const value = String(module[field]);
        const buildSystem =
          field === "buildToolVersion"
            ? (module.buildSystem as "maven" | "gradle" | "npm")
            : undefined;
        const catalogEntry = catalog.get(
          field === "buildToolVersion"
            ? `${field}\u0000${buildSystem}\u0000${value}`
            : `${field}\u0000${value}`,
        );
        if (catalogEntry === undefined) {
          continue;
        }

        const relationId = assignmentRelationshipId(
          catalogEntry.systemSoftwareId,
          module.id,
        );
        if (input.archi.getRelationship(relationId)) {
          continue;
        }

        const spec = versionFieldSpec(field as ModuleVersionField);
        let relationBuilder = AssignmentRelationship.withId(relationId)
          .source(catalogEntry.systemSoftwareId)
          .target(module.id)
          .profiles(spec.assignmentProfile.id);

        for (const property of standardGenerateElementProperties({
          logicalId: assignmentLogicalId(field, catalogEntry.systemSoftwareId, module.id),
          generatorCoordinate: GENERATOR_COORDINATE,
          slot: "syssoft-assign",
        })) {
          relationBuilder = relationBuilder.property(property.key, property.value);
        }

        relations.push(relationBuilder.build().toCreateIntent());
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
