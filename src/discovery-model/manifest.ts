export interface ManifestCollectionEntry {
  readonly path: string;
  readonly contentType: "entities" | "many-to-many";
  readonly entityType?: string;
  readonly schema?: string;
  readonly fromEntityType?: string;
  readonly toEntityType?: string;
  readonly fromIdField?: string;
  readonly toIdField?: string;
}

export interface Manifest {
  readonly formatVersion: string;
  readonly scanId?: string;
  readonly scannedAt?: string;
  readonly runConfigPath?: string;
  readonly sourceRoot?: string;
  readonly collections: readonly ManifestCollectionEntry[];
}
