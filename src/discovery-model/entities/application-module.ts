import type { DiscoveryEntityBase } from "./entity-base.js";
import { Entity } from "./entity.js";

export type BuildSystem = "maven" | "gradle" | "npm";

export interface ApplicationModuleCreateIntent {
  readonly id: string;
  readonly repositoryId: string;
  readonly buildSystem: BuildSystem;
  readonly groupId: string;
  readonly artifactId: string;
  readonly version: string;
  readonly name: string;
  readonly repoPath: string;
  readonly buildScript: string;
  readonly isMultimodule: boolean;
  readonly parentId?: string;
}

export interface ApplicationModuleNaturalKeys {
  readonly repositoryId: string;
  readonly buildSystem: BuildSystem;
  readonly groupId: string;
  readonly artifactId: string;
  readonly version: string;
  readonly name: string;
  readonly repoPath: string;
  readonly buildScript: string;
  readonly isMultimodule: boolean;
  readonly parentId?: string;
}

export class ApplicationModule extends Entity {
  private static readonly ENTITY_TYPE = "ApplicationModule" as const;

  readonly repositoryId: string;
  readonly buildSystem: BuildSystem;
  readonly groupId: string;
  readonly artifactId: string;
  readonly version: string;
  readonly name: string;
  readonly repoPath: string;
  readonly buildScript: string;
  readonly isMultimodule: boolean;
  readonly parentId?: string;

  constructor(naturalKeys: ApplicationModuleNaturalKeys) {
    super(ApplicationModule.ENTITY_TYPE, [
      naturalKeys.repositoryId,
      naturalKeys.buildSystem,
      naturalKeys.groupId,
      naturalKeys.artifactId,
    ]);
    this.repositoryId = naturalKeys.repositoryId;
    this.buildSystem = naturalKeys.buildSystem;
    this.groupId = naturalKeys.groupId;
    this.artifactId = naturalKeys.artifactId;
    this.version = naturalKeys.version;
    this.name = naturalKeys.name;
    this.repoPath = naturalKeys.repoPath;
    this.buildScript = naturalKeys.buildScript;
    this.isMultimodule = naturalKeys.isMultimodule;
    if (naturalKeys.parentId !== undefined) {
      this.parentId = naturalKeys.parentId;
    }
  }

  static idForCoordinates(
    repositoryId: string,
    buildSystem: BuildSystem,
    groupId: string,
    artifactId: string,
  ): string {
    return new ApplicationModule({
      repositoryId,
      buildSystem,
      groupId,
      artifactId,
      version: "",
      name: "",
      repoPath: "",
      buildScript: "",
      isMultimodule: false,
    }).id;
  }

  toCreateIntent(): ApplicationModuleCreateIntent {
    return {
      id: this.id,
      repositoryId: this.repositoryId,
      buildSystem: this.buildSystem,
      groupId: this.groupId,
      artifactId: this.artifactId,
      version: this.version,
      name: this.name,
      repoPath: this.repoPath,
      buildScript: this.buildScript,
      isMultimodule: this.isMultimodule,
      ...(this.parentId !== undefined ? { parentId: this.parentId } : {}),
    };
  }
}

export interface ApplicationModuleRecord
  extends DiscoveryEntityBase,
    ApplicationModuleCreateIntent {}
