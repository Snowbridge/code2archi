import type { ArchiElement, ArchiElementCreateIntent } from "./elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "./folders/archi-folder.js";
import type { ArchiProfile, ArchiProfileCreateIntent } from "./profiles/profile.js";

export type ArchiElementRecord = ArchiElement | ArchiElementCreateIntent;
export type ArchiProfileRecord = ArchiProfile | ArchiProfileCreateIntent;

export interface ArchiCreateIntents {
  readonly folders?: readonly ArchiFolderCreateIntent[];
  readonly elements?: readonly ArchiElementRecord[];
  readonly profiles?: readonly ArchiProfileRecord[];
}
