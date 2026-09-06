import type { DiscoveryEntityBase } from "./entity-base.js";
import { Entity } from "./entity.js";

export interface ApplicationModuleDependencyCreateIntent {
  readonly id: string;
  readonly parentId: string;
  readonly groupId: string;
  readonly artifactId: string;
  readonly version: string;
}

export interface ApplicationModuleDependencyNaturalKeys {
  readonly parentId: string;
  readonly groupId: string;
  readonly artifactId: string;
  readonly version: string;
}

export class ApplicationModuleDependency extends Entity {
  private static readonly ENTITY_TYPE = "ApplicationModuleDependency" as const;

  readonly parentId: string;
  readonly groupId: string;
  readonly artifactId: string;
  readonly version: string;

  constructor(naturalKeys: ApplicationModuleDependencyNaturalKeys) {
    super(ApplicationModuleDependency.ENTITY_TYPE, [
      naturalKeys.parentId,
      naturalKeys.groupId,
      naturalKeys.artifactId,
      naturalKeys.version,
    ]);
    this.parentId = naturalKeys.parentId;
    this.groupId = naturalKeys.groupId;
    this.artifactId = naturalKeys.artifactId;
    this.version = naturalKeys.version;
  }

  toCreateIntent(): ApplicationModuleDependencyCreateIntent {
    return {
      id: this.id,
      parentId: this.parentId,
      groupId: this.groupId,
      artifactId: this.artifactId,
      version: this.version,
    };
  }
}

export interface ApplicationModuleDependencyRecord
  extends DiscoveryEntityBase,
    ApplicationModuleDependencyCreateIntent {}
