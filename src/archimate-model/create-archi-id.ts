import { createHash } from "node:crypto";

export function createArchiId(kind: string, ...stableKeys: readonly unknown[]): string {
  const input = [kind, ...stableKeys].map(String).join(":");
  return createHash("sha256").update(input).digest("hex");
}

export function createRootFolderId(folderKey: string): string {
  return createArchiId("Folder", folderKey);
}

export function createNestedFolderId(parentFolderId: string, folderName: string): string {
  return createArchiId("Folder", parentFolderId, folderName);
}

export function createProfileId(conceptType: string, name: string): string {
  return createArchiId("Profile", conceptType, name);
}

export function createModelId(absoluteOutputPath: string): string {
  return createArchiId("Model", absoluteOutputPath);
}
