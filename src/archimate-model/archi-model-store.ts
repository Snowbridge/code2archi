import type { ProcessorGroupId } from "../cli/processor-groups.js";
import type { ProcessorId } from "../platform/processors/processor.js";
import type { ArchiCreateIntents } from "./archi-create-intents.js";
import {
  type ConceptType,
  getConceptLayer,
  isConceptType,
  PREDEFINED_FOLDERS,
  type PredefinedFolderKey,
} from "./concept-types.js";
import { createNestedFolderId, createProfileId, createRootFolderId } from "./create-archi-id.js";
import type { ArchiElement, ArchiElementCreateIntent } from "./elements/archi-element.js";
import type { ArchiFolder, ArchiFolderCreateIntent } from "./folders/archi-folder.js";
import type { ArchiProfile, ArchiProfileCreateIntent } from "./profiles/profile.js";

export interface ArchiModelSnapshot {
  getFolder(id: string): ArchiFolder | undefined;
  findFolders(query: ArchiFolderQuery): readonly ArchiFolder[];
  getElement(id: string): ArchiElement | undefined;
  findById(id: string): ArchiFolder | ArchiElement | ArchiProfile | undefined;
  findByConceptTypeAndName(
    conceptType: ConceptType,
    name: string,
  ): readonly ArchiElement[];
  findProfile(name: string, conceptType: ConceptType | string): ArchiProfile | undefined;
  listFolders(): readonly ArchiFolder[];
  listElements(): readonly ArchiElement[];
  listProfiles(): readonly ArchiProfile[];
  getPredefinedFolderId(key: PredefinedFolderKey): string;
}

export interface ArchiFolderQuery {
  readonly id?: string;
  readonly parentFolderId?: string;
  readonly name?: string;
}

export interface ArchiModelStoreInit {
  readonly modelName: string;
  readonly modelId: string;
}

/** Mirror of documentation/specifications/archimate-model/in-memory-api.md */
const GROUP_CONCEPT_ALLOWLIST: Partial<Record<ProcessorGroupId, readonly ConceptType[]>> = {
  "generate-biz": [
    "BusinessActor",
    "BusinessRole",
    "BusinessCollaboration",
    "BusinessInterface",
    "BusinessProcess",
    "BusinessFunction",
    "BusinessInteraction",
    "BusinessEvent",
    "BusinessService",
    "BusinessObject",
    "Contract",
    "Representation",
    "Product",
  ],
  "generate-app": [
    "ApplicationComponent",
    "ApplicationCollaboration",
    "ApplicationInterface",
    "ApplicationFunction",
    "ApplicationInteraction",
    "ApplicationProcess",
    "ApplicationEvent",
    "ApplicationService",
    "DataObject",
  ],
  "generate-tech": [
    "Node",
    "Device",
    "SystemSoftware",
    "TechnologyCollaboration",
    "TechnologyInterface",
    "Path",
    "CommunicationNetwork",
    "TechnologyFunction",
    "TechnologyProcess",
    "TechnologyInteraction",
    "TechnologyEvent",
    "TechnologyService",
    "Artifact",
    "Equipment",
    "Facility",
    "DistributionNetwork",
    "Material",
  ],
  "generate-view": ["ArchimateDiagramModel"],
};

const GROUP_FOLDER_ROOT_ALLOWLIST: Partial<
  Record<ProcessorGroupId, readonly PredefinedFolderKey[]>
> = {
  "generate-biz": ["business"],
  "generate-app": ["application"],
  "generate-tech": ["technology"],
  "generate-view": ["diagrams"],
};

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.freeze(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    return value;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }

  return value;
}

class FrozenArchiModelSnapshot implements ArchiModelSnapshot {
  constructor(
    private readonly folders: ReadonlyMap<string, ArchiFolder>,
    private readonly elements: ReadonlyMap<string, ArchiElement>,
    private readonly profiles: ReadonlyMap<string, ArchiProfile>,
    private readonly predefinedFolderIds: Readonly<Record<PredefinedFolderKey, string>>,
  ) {}

  getFolder(id: string): ArchiFolder | undefined {
    return this.folders.get(id);
  }

  findFolders(query: ArchiFolderQuery): readonly ArchiFolder[] {
    const matches: ArchiFolder[] = [];

    for (const folder of this.folders.values()) {
      if (query.id !== undefined && folder.id !== query.id) {
        continue;
      }
      if (
        query.parentFolderId !== undefined &&
        folder.parentFolderId !== query.parentFolderId
      ) {
        continue;
      }
      if (query.name !== undefined && folder.name !== query.name) {
        continue;
      }
      matches.push(folder);
    }

    return matches.sort((a, b) => a.id.localeCompare(b.id));
  }

  getElement(id: string): ArchiElement | undefined {
    return this.elements.get(id);
  }

  findById(id: string): ArchiFolder | ArchiElement | ArchiProfile | undefined {
    return (
      this.folders.get(id) ?? this.elements.get(id) ?? this.profiles.get(id)
    );
  }

  findByConceptTypeAndName(
    conceptType: ConceptType,
    name: string,
  ): readonly ArchiElement[] {
    return [...this.elements.values()]
      .filter((element) => element.conceptType === conceptType && element.name === name)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  findProfile(name: string, conceptType: ConceptType | string): ArchiProfile | undefined {
    const id = createProfileId(conceptType, name);
    const profile = this.profiles.get(id);
    if (profile && profile.name === name && profile.conceptType === conceptType) {
      return profile;
    }
    return [...this.profiles.values()].find(
      (candidate) => candidate.name === name && candidate.conceptType === conceptType,
    );
  }

  listFolders(): readonly ArchiFolder[] {
    return [...this.folders.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listElements(): readonly ArchiElement[] {
    return [...this.elements.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listProfiles(): readonly ArchiProfile[] {
    return [...this.profiles.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  getPredefinedFolderId(key: PredefinedFolderKey): string {
    return this.predefinedFolderIds[key];
  }
}

export class ArchiModelStore {
  private readonly folders = new Map<string, ArchiFolder>();
  private readonly elements = new Map<string, ArchiElement>();
  private readonly profiles = new Map<string, ArchiProfile>();
  private readonly globalIds = new Set<string>();
  private readonly predefinedFolderIds: Record<PredefinedFolderKey, string>;
  readonly modelName: string;
  readonly modelId: string;

  constructor(init: ArchiModelStoreInit) {
    this.modelName = init.modelName;
    this.modelId = init.modelId;
    this.predefinedFolderIds = {} as Record<PredefinedFolderKey, string>;

    for (const def of PREDEFINED_FOLDERS) {
      const id = createRootFolderId(def.key);
      this.predefinedFolderIds[def.key] = id;
      this.addFolderRecord(
        {
          id,
          name: def.xmlName,
          xmlType: def.xmlType,
        },
        true,
      );
    }
  }

  getPredefinedFolderId(key: PredefinedFolderKey): string {
    return this.predefinedFolderIds[key];
  }

  createFolder(parentFolderId: string, folderName: string): ArchiFolder {
    const parent = this.folders.get(parentFolderId);
    if (!parent) {
      throw new Error(`Parent folder not found: ${parentFolderId}`);
    }

    const id = createNestedFolderId(parentFolderId, folderName);
    return this.addFolderRecord(
      {
        id,
        name: folderName,
        parentFolderId,
      },
      false,
    );
  }

  createProfile(name: string, conceptType: ConceptType | string): ArchiProfile {
    const id = createProfileId(conceptType, name);
    if (this.profiles.has(id) || this.globalIds.has(id)) {
      throw new Error(`Duplicate profile: ${name} (${conceptType})`);
    }

    const profile: ArchiProfile = Object.freeze({ id, name, conceptType });
    this.profiles.set(id, profile);
    this.globalIds.add(id);
    return profile;
  }

  addCreateIntents(
    groupId: ProcessorGroupId,
    processorId: ProcessorId,
    intents: ArchiCreateIntents,
  ): void {
    if (processorId.groupId !== groupId) {
      throw new Error(
        `Processor groupId mismatch: expected ${groupId}, got ${processorId.groupId}`,
      );
    }

    if (intents.folders) {
      for (const folderIntent of intents.folders) {
        this.addFolderIntent(groupId, folderIntent);
      }
    }

    if (intents.elements) {
      for (const elementIntent of intents.elements) {
        this.addElementIntent(groupId, elementIntent);
      }
    }

    if (intents.profiles) {
      for (const profileIntent of intents.profiles) {
        this.addProfileIntent(groupId, profileIntent);
      }
    }
  }

  snapshot(): ArchiModelSnapshot {
    return deepFreeze(
      new FrozenArchiModelSnapshot(
        deepFreeze(new Map(this.folders)),
        deepFreeze(new Map(this.elements)),
        deepFreeze(new Map(this.profiles)),
        deepFreeze({ ...this.predefinedFolderIds }),
      ),
    );
  }

  listFolders(): readonly ArchiFolder[] {
    return [...this.folders.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listElements(): readonly ArchiElement[] {
    return [...this.elements.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listProfiles(): readonly ArchiProfile[] {
    return [...this.profiles.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  private addFolderIntent(groupId: ProcessorGroupId, intent: ArchiFolderCreateIntent): void {
    if (intent.parentFolderId) {
      this.assertFolderAllowedForGroup(groupId, intent.parentFolderId);
    } else if (!this.folders.has(intent.id)) {
      throw new Error(`Custom root folders cannot be created via intents: ${intent.id}`);
    }

    this.addFolderRecord(intent, false);
  }

  private addElementIntent(groupId: ProcessorGroupId, intent: ArchiElementCreateIntent): void {
    if (!isConceptType(intent.conceptType)) {
      throw new Error(`Unknown concept type: ${intent.conceptType}`);
    }

    const allowedConcepts = GROUP_CONCEPT_ALLOWLIST[groupId];
    if (!allowedConcepts || !allowedConcepts.includes(intent.conceptType)) {
      throw new Error(
        `Concept type ${intent.conceptType} is not allowed for processor group ${groupId}`,
      );
    }

    const folder = this.folders.get(intent.folderId);
    if (!folder) {
      throw new Error(`Folder not found for element: ${intent.folderId}`);
    }

    this.assertElementFolderMatchesConcept(intent.conceptType, folder);

    if (this.globalIds.has(intent.id)) {
      throw new Error(`Duplicate id: ${intent.id} (element: ${intent.conceptType})`);
    }

    const element: ArchiElement = Object.freeze({ ...intent });
    this.elements.set(intent.id, element);
    this.globalIds.add(intent.id);
  }

  private addProfileIntent(groupId: ProcessorGroupId, intent: ArchiProfileCreateIntent): void {
    if (groupId === "generate-rel") {
      throw new Error("Profiles are not allowed for processor group generate-rel");
    }

    if (this.globalIds.has(intent.id)) {
      throw new Error(`Duplicate profile id: ${intent.id}`);
    }

    const existing = this.findProfileByNameAndType(intent.name, intent.conceptType);
    if (existing) {
      throw new Error(`Duplicate profile: ${intent.name} (${intent.conceptType})`);
    }

    const profile: ArchiProfile = Object.freeze({ ...intent });
    this.profiles.set(intent.id, profile);
    this.globalIds.add(intent.id);
  }

  private addFolderRecord(intent: ArchiFolderCreateIntent, isPredefined: boolean): ArchiFolder {
    if (this.globalIds.has(intent.id)) {
      throw new Error(`Duplicate folder id: ${intent.id}`);
    }

    const folder: ArchiFolder = Object.freeze({
      id: intent.id,
      name: intent.name,
      ...(intent.parentFolderId ? { parentFolderId: intent.parentFolderId } : {}),
      ...(intent.xmlType ? { xmlType: intent.xmlType } : {}),
      isPredefined,
    });

    this.folders.set(intent.id, folder);
    this.globalIds.add(intent.id);
    return folder;
  }

  private assertFolderAllowedForGroup(groupId: ProcessorGroupId, parentFolderId: string): void {
    const allowedRoots = GROUP_FOLDER_ROOT_ALLOWLIST[groupId];
    if (!allowedRoots) {
      throw new Error(`Folder create-intents are not allowed for processor group ${groupId}`);
    }

    const rootId = this.resolveRootFolderId(parentFolderId);
    const allowedRootIds = allowedRoots.map((key) => this.predefinedFolderIds[key]);
    if (!allowedRootIds.includes(rootId)) {
      throw new Error(
        `Folder parent ${parentFolderId} is not under allowed roots for group ${groupId}`,
      );
    }
  }

  private resolveRootFolderId(folderId: string): string {
    let current = this.folders.get(folderId);
    if (!current) {
      throw new Error(`Folder not found: ${folderId}`);
    }

    while (current.parentFolderId) {
      const parent = this.folders.get(current.parentFolderId);
      if (!parent) {
        throw new Error(`Folder chain broken at ${current.parentFolderId}`);
      }
      current = parent;
    }

    return current.id;
  }

  private assertElementFolderMatchesConcept(
    conceptType: ConceptType,
    folder: ArchiFolder,
  ): void {
    const layer = getConceptLayer(conceptType);
    if (!layer) {
      throw new Error(`Concept type ${conceptType} has no layer mapping`);
    }

    const rootId = this.resolveRootFolderId(folder.id);
    if (rootId !== this.predefinedFolderIds[layer]) {
      throw new Error(
        `Element ${conceptType} must be placed under ${layer} folder, got ${folder.id}`,
      );
    }
  }

  private findProfileByNameAndType(
    name: string,
    conceptType: ConceptType | string,
  ): ArchiProfile | undefined {
    return [...this.profiles.values()].find(
      (profile) => profile.name === name && profile.conceptType === conceptType,
    );
  }
}
