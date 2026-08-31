import type { ArchiCreateIntents } from "../../archimate-model/archi-create-intents.js";
import {
  Artifact,
  type ArchiElementCreateIntent,
} from "../../archimate-model/elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "../../archimate-model/folders/archi-folder.js";
import { GitRepoProfile } from "../../archimate-model/profiles/profile.js";
import {
  ensureChildFolder,
  ensureFolderPath,
  parseNamespaceSegments,
} from "../../generate/archi-folder-path.js";
import { standardGenerateElementProperties } from "../../generate/archi-element-properties.js";
import { withEntityDebugProperties } from "../../generate/generate-debug.js";
import type { DiscoveryEntityRecord } from "../../discovery-model/entities/entity-types.js";
import {
  AbstractProcessor,
  type GenerateProcessorInput,
  type ProcessorId,
} from "../../platform/processors/processor.js";

export const CODE_REPOSITORIES_FOLDER = "Code repositories";

const GENERATOR_COORDINATE = "generate.elements.technology:repositories";

export class RepositoriesProcessor extends AbstractProcessor<
  GenerateProcessorInput,
  ArchiCreateIntents
> {
  readonly id: ProcessorId = {
    groupId: "generate.elements.technology",
    artifactId: "repositories",
  };

  readonly version = "0.1.0";

  readonly executionPolicy = "ALWAYS" as const;

  readonly description =
    "Maps Repository entities to Technology Artifact elements with Source code repo profile.";

  protected doProcess(input: GenerateProcessorInput): ArchiCreateIntents {
    const pendingFolders = new Map<string, ArchiFolderCreateIntent>();
    const folderIntents: ArchiFolderCreateIntent[] = [];
    const elements: ArchiElementCreateIntent[] = [];

    const technologyFolderId = input.archi.getPredefinedFolderId("technology");
    const codeRepositories = ensureChildFolder(
      input.archi,
      technologyFolderId,
      CODE_REPOSITORIES_FOLDER,
      pendingFolders,
    );
    if (codeRepositories.folderIntent) {
      folderIntents.push(codeRepositories.folderIntent);
    }

    const gitRepoProfile = GitRepoProfile.create();
    const profiles =
      input.archi.findProfile(gitRepoProfile.name, gitRepoProfile.conceptType) === undefined
        ? [gitRepoProfile]
        : [];

    const repositories = [...input.discovery.listEntities("Repository")].sort((left, right) =>
      left.id.localeCompare(right.id),
    );

    for (const repository of repositories) {
      const namespaceSegments = parseNamespaceSegments(String(repository.namespace));
      const targetFolder = ensureFolderPath(
        input.archi,
        codeRepositories.folderId,
        namespaceSegments,
        pendingFolders,
      );
      folderIntents.push(...targetFolder.folderIntents);

      if (input.archi.getElement(repository.id)) {
        continue;
      }

      let elementBuilder = Artifact.withId(repository.id)
        .name(String(repository.name))
        .inFolder(targetFolder.folderId)
        .profiles(gitRepoProfile.id)
        .property("c2a:url", String(repository.url));

      for (const property of standardGenerateElementProperties({
        logicalId: repository.id,
        generatorCoordinate: GENERATOR_COORDINATE,
      })) {
        elementBuilder = elementBuilder.property(property.key, property.value);
      }

      const elementIntent = withEntityDebugProperties(elementBuilder.build().toCreateIntent(), [
        {
          entityType: "Repository",
          record: repository as DiscoveryEntityRecord,
        },
      ]);
      elements.push(elementIntent);
    }

    const uniqueFolderIntents = dedupeFolderIntents(folderIntents);

    return {
      ...(uniqueFolderIntents.length > 0 ? { folders: uniqueFolderIntents } : {}),
      ...(profiles.length > 0 ? { profiles } : {}),
      ...(elements.length > 0 ? { elements } : {}),
    };
  }
}

function dedupeFolderIntents(
  folderIntents: readonly ArchiFolderCreateIntent[],
): ArchiFolderCreateIntent[] {
  const byId = new Map<string, ArchiFolderCreateIntent>();
  for (const folderIntent of folderIntents) {
    byId.set(folderIntent.id, folderIntent);
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}
