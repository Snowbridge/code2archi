import type { ArchiElementCreateIntent } from "./elements/archi-element.js";
import type { ArchiFolderCreateIntent } from "./folders/archi-folder.js";
import type { ArchiProfileCreateIntent } from "./profiles/profile.js";

export interface ArchiCreateIntents {
  readonly folders?: readonly ArchiFolderCreateIntent[];
  readonly elements?: readonly ArchiElementCreateIntent[];
  readonly profiles?: readonly ArchiProfileCreateIntent[];
}
