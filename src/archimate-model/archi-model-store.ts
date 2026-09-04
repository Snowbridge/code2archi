import type { BuiltInProcessorGroupId } from "../cli/processor-groups.js";
import { resolveBuiltInGroupId } from "../platform/processors/processor-coordinate.js";
import type { ProcessorId } from "../platform/processors/processor.js";
import { computeArchiId } from "./archi-id.js";
import type { ArchiCreateIntents } from "./archi-create-intents.js";
import {
  type ConceptType,
  getConceptLayer,
  isConceptType,
  CONCEPT_TYPES,
  PREDEFINED_FOLDERS,
  type PredefinedFolderKey,
} from "./concept-types.js";
import { ArchiElement, type ArchiElementCreateIntent } from "./elements/archi-element.js";
import {
  ArchiFolderIds,
  type ArchiFolder,
  type ArchiFolderCreateIntent,
} from "./folders/archi-folder.js";
import { ArchiProfile, type ArchiProfileCreateIntent, type ProfileConceptType } from "./profiles/profile.js";
import { isRelationType, type RelationType } from "./relation-types.js";
import {
  ArchiRelationship,
  type ArchiRelationshipCreateIntent,
} from "./relationships/archi-relationship.js";
import { sortFolderIntentsParentFirst } from "../generate/archi-folder-path.js";

const GENERATE_ELEMENTS_RELATION_TYPES: readonly RelationType[] = [
  "AccessRelationship",
  "AggregationRelationship",
  "AssignmentRelationship",
  "AssociationRelationship",
  "CompositionRelationship",
  "FlowRelationship",
  "RealizationRelationship",
  "ServingRelationship",
  "TriggeringRelationship",
];

export interface ArchiModelSnapshot {
  getFolder(id: string): ArchiFolder | undefined;
  findFolders(query: ArchiFolderQuery): readonly ArchiFolder[];
  getElement(id: string): ArchiElementCreateIntent | undefined;
  getRelationship(id: string): ArchiRelationshipCreateIntent | undefined;
  findById(
    id: string,
  ):
    | ArchiFolder
    | ArchiElementCreateIntent
    | ArchiProfileCreateIntent
    | ArchiRelationshipCreateIntent
    | undefined;
  findByConceptTypeAndName(
    conceptType: ConceptType,
    name: string,
  ): readonly ArchiElementCreateIntent[];
  findProfile(name: string, conceptType: ProfileConceptType): ArchiProfileCreateIntent | undefined;
  listFolders(): readonly ArchiFolder[];
  listElements(): readonly ArchiElementCreateIntent[];
  listProfiles(): readonly ArchiProfileCreateIntent[];
  listRelations(): readonly ArchiRelationshipCreateIntent[];
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
const GENERATE_ELEMENTS_CONCEPT_TYPES = CONCEPT_TYPES.filter(
  (conceptType) => conceptType !== "ArchimateDiagramModel",
);

const GROUP_CONCEPT_ALLOWLIST: Partial<Record<BuiltInProcessorGroupId, readonly ConceptType[]>> = {
  "generate.elements": GENERATE_ELEMENTS_CONCEPT_TYPES,
  "generate.views": ["ArchimateDiagramModel"],
};

const ALL_PREDEFINED_FOLDER_KEYS: readonly PredefinedFolderKey[] = [
  "business",
  "application",
  "technology",
  "relations",
  "diagrams",
];

const GROUP_FOLDER_ROOT_ALLOWLIST: Partial<
  Record<BuiltInProcessorGroupId, readonly PredefinedFolderKey[]>
> = {
  "generate.elements": ALL_PREDEFINED_FOLDER_KEYS,
  "generate.views": ["diagrams"],
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

function toArchiElementCreateIntent(
  record: ArchiElement | ArchiElementCreateIntent,
): ArchiElementCreateIntent {
  if (record instanceof ArchiElement) {
    return record.toCreateIntent();
  }

  return record;
}

function toArchiProfileCreateIntent(
  record: ArchiProfile | ArchiProfileCreateIntent,
): ArchiProfileCreateIntent {
  if (record instanceof ArchiProfile) {
    return record.toCreateIntent();
  }

  return record;
}

function toArchiRelationshipCreateIntent(
  record: ArchiRelationship | ArchiRelationshipCreateIntent,
): ArchiRelationshipCreateIntent {
  if (record instanceof ArchiRelationship) {
    return record.toCreateIntent();
  }

  return record;
}

class FrozenArchiModelSnapshot implements ArchiModelSnapshot {
  constructor(
    private readonly folders: ReadonlyMap<string, ArchiFolder>,
    private readonly elements: ReadonlyMap<string, ArchiElementCreateIntent>,
    private readonly profiles: ReadonlyMap<string, ArchiProfileCreateIntent>,
    private readonly relations: ReadonlyMap<string, ArchiRelationshipCreateIntent>,
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

  getElement(id: string): ArchiElementCreateIntent | undefined {
    return this.elements.get(id);
  }

  getRelationship(id: string): ArchiRelationshipCreateIntent | undefined {
    return this.relations.get(id);
  }

  findById(
    id: string,
  ):
    | ArchiFolder
    | ArchiElementCreateIntent
    | ArchiProfileCreateIntent
    | ArchiRelationshipCreateIntent
    | undefined {
    return (
      this.folders.get(id) ??
      this.elements.get(id) ??
      this.profiles.get(id) ??
      this.relations.get(id)
    );
  }

  findByConceptTypeAndName(
    conceptType: ConceptType,
    name: string,
  ): readonly ArchiElementCreateIntent[] {
    return [...this.elements.values()]
      .filter((element) => element.conceptType === conceptType && element.name === name)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  findProfile(name: string, conceptType: ProfileConceptType): ArchiProfileCreateIntent | undefined {
    const id = ArchiProfile.computeId(conceptType, name);
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

  listElements(): readonly ArchiElementCreateIntent[] {
    return [...this.elements.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listProfiles(): readonly ArchiProfileCreateIntent[] {
    return [...this.profiles.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listRelations(): readonly ArchiRelationshipCreateIntent[] {
    return [...this.relations.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  getPredefinedFolderId(key: PredefinedFolderKey): string {
    return this.predefinedFolderIds[key];
  }
}

export function createArchiModelSnapshot(init: {
  readonly folders: readonly ArchiFolder[];
  readonly elements: readonly ArchiElementCreateIntent[];
  readonly profiles: readonly ArchiProfileCreateIntent[];
  readonly relations: readonly ArchiRelationshipCreateIntent[];
  readonly predefinedFolderIds: Readonly<Record<PredefinedFolderKey, string>>;
}): ArchiModelSnapshot {
  const folders = new Map(
    init.folders.map((folder) => [folder.id, deepFreeze({ ...folder })] as const),
  );
  const elements = new Map(
    init.elements.map((element) => [element.id, deepFreeze({ ...element })] as const),
  );
  const profiles = new Map(
    init.profiles.map((profile) => [profile.id, deepFreeze({ ...profile })] as const),
  );
  const relations = new Map(
    init.relations.map((relation) => [relation.id, deepFreeze({ ...relation })] as const),
  );

  return deepFreeze(
    new FrozenArchiModelSnapshot(
      deepFreeze(folders),
      deepFreeze(elements),
      deepFreeze(profiles),
      deepFreeze(relations),
      deepFreeze({ ...init.predefinedFolderIds }),
    ),
  );
}

export class ArchiModelStore {
  private readonly folders = new Map<string, ArchiFolder>();
  private readonly elements = new Map<string, ArchiElementCreateIntent>();
  private readonly profiles = new Map<string, ArchiProfileCreateIntent>();
  private readonly relations = new Map<string, ArchiRelationshipCreateIntent>();
  private readonly globalIds = new Set<string>();
  private readonly predefinedFolderIds: Record<PredefinedFolderKey, string>;
  readonly modelName: string;
  readonly modelId: string;

  constructor(init: ArchiModelStoreInit) {
    this.modelName = init.modelName;
    this.modelId = init.modelId;
    this.predefinedFolderIds = {} as Record<PredefinedFolderKey, string>;

    for (const def of PREDEFINED_FOLDERS) {
      const id = ArchiFolderIds.rootIdFor(def.key);
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

  static computeModelId(absoluteOutputPath: string): string {
    return computeArchiId("Model", absoluteOutputPath);
  }

  getPredefinedFolderId(key: PredefinedFolderKey): string {
    return this.predefinedFolderIds[key];
  }

  createFolder(parentFolderId: string, folderName: string): ArchiFolder {
    const parent = this.folders.get(parentFolderId);
    if (!parent) {
      throw new Error(`Parent folder not found: ${parentFolderId}`);
    }

    const id = ArchiFolderIds.nestedId(parentFolderId, folderName);
    return this.addFolderRecord(
      {
        id,
        name: folderName,
        parentFolderId,
      },
      false,
    );
  }

  registerProfile(profile: ArchiProfile): ArchiProfileCreateIntent {
    const intent = profile.toCreateIntent();
    if (this.profiles.has(intent.id) || this.globalIds.has(intent.id)) {
      throw new Error(`Duplicate profile: ${intent.name} (${intent.conceptType})`);
    }

    const frozen = Object.freeze({ ...intent });
    this.profiles.set(intent.id, frozen);
    this.globalIds.add(intent.id);
    return frozen;
  }

  addCreateIntents(
    builtInGroupId: BuiltInProcessorGroupId,
    processorId: ProcessorId,
    intents: ArchiCreateIntents,
  ): void {
    const processorBuiltInGroupId = resolveBuiltInGroupId(processorId.groupId);
    if (processorBuiltInGroupId !== builtInGroupId) {
      throw new Error(
        `Processor groupId mismatch: expected built-in group ${builtInGroupId}, got ${processorId.groupId}`,
      );
    }

    if (intents.folders && intents.folders.length > 0) {
      const orderedFolders = sortFolderIntentsParentFirst(intents.folders, new Set(this.folders.keys()));
      for (const folderIntent of orderedFolders) {
        this.addFolderIntent(builtInGroupId, folderIntent);
      }
    }

    if (intents.elements) {
      for (const elementRecord of intents.elements) {
        this.addElementIntent(builtInGroupId, toArchiElementCreateIntent(elementRecord));
      }
    }

    if (intents.profiles) {
      for (const profileRecord of intents.profiles) {
        this.addProfileIntent(builtInGroupId, toArchiProfileCreateIntent(profileRecord));
      }
    }

    if (intents.relations) {
      for (const relationRecord of intents.relations) {
        this.addRelationIntent(builtInGroupId, toArchiRelationshipCreateIntent(relationRecord));
      }
    }
  }

  validateForWrite(): void {
    for (const relation of this.relations.values()) {
      if (!this.elements.has(relation.sourceId)) {
        throw new Error(
          `Relationship ${relation.id} references missing source element: ${relation.sourceId}`,
        );
      }
      if (!this.elements.has(relation.targetId)) {
        throw new Error(
          `Relationship ${relation.id} references missing target element: ${relation.targetId}`,
        );
      }
    }
  }

  snapshot(): ArchiModelSnapshot {
    return deepFreeze(
      new FrozenArchiModelSnapshot(
        deepFreeze(new Map(this.folders)),
        deepFreeze(new Map(this.elements)),
        deepFreeze(new Map(this.profiles)),
        deepFreeze(new Map(this.relations)),
        deepFreeze({ ...this.predefinedFolderIds }),
      ),
    );
  }

  listFolders(): readonly ArchiFolder[] {
    return [...this.folders.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listElements(): readonly ArchiElementCreateIntent[] {
    return [...this.elements.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listProfiles(): readonly ArchiProfileCreateIntent[] {
    return [...this.profiles.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listRelations(): readonly ArchiRelationshipCreateIntent[] {
    return [...this.relations.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  private addFolderIntent(builtInGroupId: BuiltInProcessorGroupId, intent: ArchiFolderCreateIntent): void {
    if (this.folders.has(intent.id)) {
      return;
    }

    if (intent.parentFolderId) {
      this.assertFolderAllowedForGroup(builtInGroupId, intent.parentFolderId);
    } else if (!this.folders.has(intent.id)) {
      throw new Error(`Custom root folders cannot be created via intents: ${intent.id}`);
    }

    this.addFolderRecord(intent, false);
  }

  private addElementIntent(builtInGroupId: BuiltInProcessorGroupId, intent: ArchiElementCreateIntent): void {
    if (!isConceptType(intent.conceptType)) {
      throw new Error(`Unknown concept type: ${intent.conceptType}`);
    }

    const allowedConcepts = GROUP_CONCEPT_ALLOWLIST[builtInGroupId];
    if (!allowedConcepts || !allowedConcepts.includes(intent.conceptType)) {
      throw new Error(
        `Concept type ${intent.conceptType} is not allowed for processor group ${builtInGroupId}`,
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

    const element = Object.freeze({ ...intent });
    this.elements.set(intent.id, element);
    this.globalIds.add(intent.id);
  }

  private addProfileIntent(builtInGroupId: BuiltInProcessorGroupId, intent: ArchiProfileCreateIntent): void {
    if (builtInGroupId === "generate.views") {
      throw new Error("Profiles are not allowed for processor group generate.views");
    }

    if (this.globalIds.has(intent.id)) {
      throw new Error(`Duplicate profile id: ${intent.id}`);
    }

    const existing = this.findProfileByNameAndType(intent.name, intent.conceptType);
    if (existing) {
      throw new Error(`Duplicate profile: ${intent.name} (${intent.conceptType})`);
    }

    const profile = Object.freeze({ ...intent });
    this.profiles.set(intent.id, profile);
    this.globalIds.add(intent.id);
  }

  private addRelationIntent(
    builtInGroupId: BuiltInProcessorGroupId,
    intent: ArchiRelationshipCreateIntent,
  ): void {
    if (builtInGroupId !== "generate.elements") {
      throw new Error(
        `Relationship create-intents are not allowed for processor group ${builtInGroupId}`,
      );
    }

    if (!isRelationType(intent.relationType)) {
      throw new Error(`Unknown relationship type: ${intent.relationType}`);
    }

    if (!GENERATE_ELEMENTS_RELATION_TYPES.includes(intent.relationType)) {
      throw new Error(
        `Relationship type ${intent.relationType} is not allowed for processor group ${builtInGroupId}`,
      );
    }

    if (this.globalIds.has(intent.id)) {
      throw new Error(`Duplicate id: ${intent.id} (relationship: ${intent.relationType})`);
    }

    const relation = Object.freeze({ ...intent });
    this.relations.set(intent.id, relation);
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

  private assertFolderAllowedForGroup(
    builtInGroupId: BuiltInProcessorGroupId,
    parentFolderId: string,
  ): void {
    const allowedRoots = GROUP_FOLDER_ROOT_ALLOWLIST[builtInGroupId];
    if (!allowedRoots) {
      throw new Error(`Folder create-intents are not allowed for processor group ${builtInGroupId}`);
    }

    const rootId = this.resolveRootFolderId(parentFolderId);
    const allowedRootIds = allowedRoots.map((key) => this.predefinedFolderIds[key]);
    if (!allowedRootIds.includes(rootId)) {
      throw new Error(
        `Folder parent ${parentFolderId} is not under allowed roots for group ${builtInGroupId}`,
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
    conceptType: ProfileConceptType,
  ): ArchiProfileCreateIntent | undefined {
    return [...this.profiles.values()].find(
      (profile) => profile.name === name && profile.conceptType === conceptType,
    );
  }
}
