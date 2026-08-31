import type { DiscoveryEntityBase } from "./entity-base.js";
import { Entity } from "./entity.js";
import { UNKNOWN_VERSION } from "../../parsers/build-tool-versions.js";

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
  readonly buildToolVersion: string;
  readonly javaVersion: string;
  readonly kotlinJvmTarget: string;
  readonly kotlinCompilerVersion: string;
  readonly nodeVersion: string;
  readonly typescriptVersion: string;
  readonly tsxVersion: string;
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
  readonly buildToolVersion?: string;
  readonly javaVersion?: string;
  readonly kotlinJvmTarget?: string;
  readonly kotlinCompilerVersion?: string;
  readonly nodeVersion?: string;
  readonly typescriptVersion?: string;
  readonly tsxVersion?: string;
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
  readonly buildToolVersion: string;
  readonly javaVersion: string;
  readonly kotlinJvmTarget: string;
  readonly kotlinCompilerVersion: string;
  readonly nodeVersion: string;
  readonly typescriptVersion: string;
  readonly tsxVersion: string;
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
    this.buildToolVersion = naturalKeys.buildToolVersion ?? UNKNOWN_VERSION;
    this.javaVersion = naturalKeys.javaVersion ?? UNKNOWN_VERSION;
    this.kotlinJvmTarget = naturalKeys.kotlinJvmTarget ?? UNKNOWN_VERSION;
    this.kotlinCompilerVersion = naturalKeys.kotlinCompilerVersion ?? UNKNOWN_VERSION;
    this.nodeVersion = naturalKeys.nodeVersion ?? UNKNOWN_VERSION;
    this.typescriptVersion = naturalKeys.typescriptVersion ?? UNKNOWN_VERSION;
    this.tsxVersion = naturalKeys.tsxVersion ?? UNKNOWN_VERSION;
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
      buildToolVersion: this.buildToolVersion,
      javaVersion: this.javaVersion,
      kotlinJvmTarget: this.kotlinJvmTarget,
      kotlinCompilerVersion: this.kotlinCompilerVersion,
      nodeVersion: this.nodeVersion,
      typescriptVersion: this.typescriptVersion,
      tsxVersion: this.tsxVersion,
      ...(this.parentId !== undefined ? { parentId: this.parentId } : {}),
    };
  }
}

export interface ApplicationModuleRecord
  extends DiscoveryEntityBase,
    ApplicationModuleCreateIntent {}
