import type { ArchiModelSnapshot } from "../archimate-model/archi-model-store.js";
import {
  ArchiFolderIds,
  type ArchiFolderCreateIntent,
} from "../archimate-model/folders/archi-folder.js";

export interface EnsureChildFolderResult {
  readonly folderId: string;
  readonly folderIntent?: ArchiFolderCreateIntent;
}

export interface EnsureFolderPathResult {
  readonly folderId: string;
  readonly folderIntents: readonly ArchiFolderCreateIntent[];
}

function findChildFolderId(
  archi: ArchiModelSnapshot,
  parentFolderId: string,
  folderName: string,
  pendingFolders: ReadonlyMap<string, ArchiFolderCreateIntent>,
): string | undefined {
  const existing = archi.findFolders({ parentFolderId, name: folderName });
  if (existing.length > 0) {
    return existing[0]!.id;
  }

  const nestedId = ArchiFolderIds.nestedId(parentFolderId, folderName);
  if (pendingFolders.has(nestedId)) {
    return nestedId;
  }

  return undefined;
}

export function ensureChildFolder(
  archi: ArchiModelSnapshot,
  parentFolderId: string,
  folderName: string,
  pendingFolders: Map<string, ArchiFolderCreateIntent>,
): EnsureChildFolderResult {
  const existingId = findChildFolderId(archi, parentFolderId, folderName, pendingFolders);
  if (existingId) {
    return { folderId: existingId };
  }

  const folderId = ArchiFolderIds.nestedId(parentFolderId, folderName);
  const folderIntent: ArchiFolderCreateIntent = {
    id: folderId,
    name: folderName,
    parentFolderId,
  };
  pendingFolders.set(folderId, folderIntent);

  return { folderId, folderIntent };
}

export function ensureFolderPath(
  archi: ArchiModelSnapshot,
  parentFolderId: string,
  segmentNames: readonly string[],
  pendingFolders: Map<string, ArchiFolderCreateIntent>,
): EnsureFolderPathResult {
  const folderIntents: ArchiFolderCreateIntent[] = [];
  let currentParentId = parentFolderId;

  for (const segmentName of segmentNames) {
    const result = ensureChildFolder(archi, currentParentId, segmentName, pendingFolders);
    if (result.folderIntent) {
      folderIntents.push(result.folderIntent);
    }
    currentParentId = result.folderId;
  }

  return { folderId: currentParentId, folderIntents };
}

export function parseNamespaceSegments(namespace: string): string[] {
  if (!namespace) {
    return [];
  }

  return namespace.split("/").filter((segment) => segment.length > 0);
}
