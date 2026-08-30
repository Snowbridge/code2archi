import { computeArchiId } from "../archi-id.js";

export interface ArchiFolderCreateIntent {
  readonly id: string;
  readonly name: string;
  readonly parentFolderId?: string;
  readonly xmlType?: string;
}

export interface ArchiFolder extends ArchiFolderCreateIntent {
  readonly isPredefined: boolean;
}

export class ArchiFolderIds {
  static rootIdFor(folderKey: string): string {
    return computeArchiId("Folder", folderKey);
  }

  static nestedId(parentFolderId: string, folderName: string): string {
    return computeArchiId("Folder", parentFolderId, folderName);
  }
}
