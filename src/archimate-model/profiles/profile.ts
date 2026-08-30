import type { ConceptType } from "../concept-types.js";

export interface ArchiProfileCreateIntent {
  readonly id: string;
  readonly name: string;
  readonly conceptType: ConceptType | string;
}

export interface ArchiProfile extends ArchiProfileCreateIntent {}
