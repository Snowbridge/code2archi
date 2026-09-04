import { computeArchiId } from "../archi-id.js";
import type { ConceptType } from "../concept-types.js";
import type { RelationType } from "../relation-types.js";

export type ProfileConceptType = ConceptType | RelationType;

export interface ArchiProfileCreateIntent {
  readonly id: string;
  readonly name: string;
  readonly conceptType: ProfileConceptType;
}

export abstract class ArchiProfile {
  readonly id: string;
  readonly name: string;
  readonly conceptType: ProfileConceptType;

  protected constructor(conceptType: ProfileConceptType, name: string) {
    this.conceptType = conceptType;
    this.name = name;
    this.id = ArchiProfile.computeId(conceptType, name);
  }

  static computeId(conceptType: ProfileConceptType, name: string): string {
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

abstract class ArtifactProfile extends ArchiProfile {
  protected constructor(name: string) {
    super("Artifact", name);
  }
}

abstract class ApplicationComponentProfile extends ArchiProfile {
  protected constructor(name: string) {
    super("ApplicationComponent", name);
  }
}

abstract class ApplicationServiceProfile extends ArchiProfile {
  protected constructor(name: string) {
    super("ApplicationService", name);
  }
}

abstract class ApplicationInterfaceProfile extends ArchiProfile {
  protected constructor(name: string) {
    super("ApplicationInterface", name);
  }
}

abstract class AssignmentRelationshipProfile extends ArchiProfile {
  protected constructor(name: string) {
    super("AssignmentRelationship", name);
  }
}

abstract class ServingRelationshipProfile extends ArchiProfile {
  protected constructor(name: string) {
    super("ServingRelationship", name);
  }
}

function defineServingRelationshipProfile(profileName: string) {
  class NamedProfile extends ServingRelationshipProfile {
    static readonly CONCEPT_TYPE = "ServingRelationship" as const;
    static readonly PROFILE_NAME = profileName;

    constructor() {
      super(profileName);
    }

    static create(): NamedProfile {
      return new NamedProfile();
    }
  }

  return NamedProfile;
}

function defineArtifactProfile(profileName: string) {
  class NamedProfile extends ArtifactProfile {
    static readonly CONCEPT_TYPE = "Artifact" as const;
    static readonly PROFILE_NAME = profileName;

    constructor() {
      super(profileName);
    }

    static create(): NamedProfile {
      return new NamedProfile();
    }
  }

  return NamedProfile;
}

function defineApplicationComponentProfile(profileName: string) {
  class NamedProfile extends ApplicationComponentProfile {
    static readonly CONCEPT_TYPE = "ApplicationComponent" as const;
    static readonly PROFILE_NAME = profileName;

    constructor() {
      super(profileName);
    }

    static create(): NamedProfile {
      return new NamedProfile();
    }
  }

  return NamedProfile;
}

function defineApplicationServiceProfile(profileName: string) {
  class NamedProfile extends ApplicationServiceProfile {
    static readonly CONCEPT_TYPE = "ApplicationService" as const;
    static readonly PROFILE_NAME = profileName;

    constructor() {
      super(profileName);
    }

    static create(): NamedProfile {
      return new NamedProfile();
    }
  }

  return NamedProfile;
}

function defineApplicationInterfaceProfile(profileName: string) {
  class NamedProfile extends ApplicationInterfaceProfile {
    static readonly CONCEPT_TYPE = "ApplicationInterface" as const;
    static readonly PROFILE_NAME = profileName;

    constructor() {
      super(profileName);
    }

    static create(): NamedProfile {
      return new NamedProfile();
    }
  }

  return NamedProfile;
}

function defineAssignmentRelationshipProfile(profileName: string) {
  class NamedProfile extends AssignmentRelationshipProfile {
    static readonly CONCEPT_TYPE = "AssignmentRelationship" as const;
    static readonly PROFILE_NAME = profileName;

    constructor() {
      super(profileName);
    }

    static create(): NamedProfile {
      return new NamedProfile();
    }
  }

  return NamedProfile;
}

export const GitRepoProfile = defineArtifactProfile("Source code repo");
export const BuildScriptProfile = defineArtifactProfile("Build script");
export const MavenModuleArtifactProfile = defineArtifactProfile("Maven module");
export const GradleModuleArtifactProfile = defineArtifactProfile("Gradle module");
export const NpmModuleArtifactProfile = defineArtifactProfile("NPM module");
export const NpmModuleProfile = defineApplicationComponentProfile("NPM module");
export const MavenModuleProfile = defineApplicationComponentProfile("Maven module");
export const GradleModuleProfile = defineApplicationComponentProfile("Gradle module");
export const LibraryModuleProfile = defineApplicationComponentProfile("Library module");
export const RestControllerProfile = defineApplicationServiceProfile("REST Controller");
export const RestClientProfile = defineApplicationServiceProfile("REST Client");
export const ApiContractProfile = defineApplicationInterfaceProfile("API Contract");
export const InferredApiContractProfile = defineApplicationInterfaceProfile("Inferred API Contract");
export const RunsOnProfile = defineAssignmentRelationshipProfile("Runs on");
export const BuiltWithProfile = defineAssignmentRelationshipProfile("Built with");
export const CompiledWithProfile = defineAssignmentRelationshipProfile("Compiled with");
export const ProcessesRestRequestsProfile =
  defineServingRelationshipProfile("Processes REST requests");
