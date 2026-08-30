import { computeArchiId } from "../archi-id.js";
import type { ConceptType } from "../concept-types.js";

export interface ArchiProfileCreateIntent {
  readonly id: string;
  readonly name: string;
  readonly conceptType: ConceptType;
}

export abstract class ArchiProfile {
  readonly id: string;
  readonly name: string;
  readonly conceptType: ConceptType;

  protected constructor(conceptType: ConceptType, name: string) {
    this.conceptType = conceptType;
    this.name = name;
    this.id = ArchiProfile.computeId(conceptType, name);
  }

  static computeId(conceptType: ConceptType, name: string): string {
    return computeArchiId("Profile", conceptType, name);
  }

  toCreateIntent(): ArchiProfileCreateIntent {
    return {
      id: this.id,
      name: this.name,
      conceptType: this.conceptType,
    };
  }
}

function defineNamedProfile<T extends ConceptType>(conceptType: T, profileName: string) {
  class NamedProfile extends ArchiProfile {
    static readonly CONCEPT_TYPE = conceptType;
    static readonly PROFILE_NAME = profileName;

    constructor() {
      super(conceptType, profileName);
    }

    static create(): NamedProfile {
      return new NamedProfile();
    }
  }

  return NamedProfile;
}

export const GitRepoProfile = defineNamedProfile("Artifact", "Git repo");
export const BuildScriptProfile = defineNamedProfile("Artifact", "Build script");
export const NpmModuleProfile = defineNamedProfile("ApplicationComponent", "NPM module");
export const MavenModuleProfile = defineNamedProfile("ApplicationComponent", "Maven module");
export const GradleModuleProfile = defineNamedProfile("ApplicationComponent", "Gradle module");
export const LibraryModuleProfile = defineNamedProfile(
  "ApplicationComponent",
  "Library module",
);
export const RestControllerProfile = defineNamedProfile(
  "ApplicationService",
  "REST Controller",
);
export const RestClientProfile = defineNamedProfile(
  "ApplicationInterface",
  "REST Client",
);
