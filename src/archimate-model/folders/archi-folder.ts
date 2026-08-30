export interface ArchiFolderCreateIntent {
  readonly id: string;
  readonly name: string;
  readonly parentFolderId?: string;
  readonly xmlType?: string;
}

export interface ArchiFolder extends ArchiFolderCreateIntent {
  readonly isPredefined: boolean;
}
