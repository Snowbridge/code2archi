import type { DiscoveryEntityBase } from "./entity-base.js";
import { Entity } from "./entity.js";

export interface RepositoryCreateIntent {
  readonly id: string;
  readonly name: string;
  readonly namespace: string;
  readonly localPath: string;
  readonly url: string;
  readonly buildSystems: readonly string[];
}

export interface RepositoryNaturalKeys {
  readonly url: string;
  readonly localPath: string;
  readonly name: string;
  readonly namespace: string;
  readonly buildSystems: readonly string[];
}

export class Repository extends Entity {
  private static readonly ENTITY_TYPE = "Repository" as const;

  readonly name: string;
  readonly namespace: string;
  readonly localPath: string;
  readonly url: string;
  readonly buildSystems: readonly string[];

  constructor(naturalKeys: RepositoryNaturalKeys) {
    super(Repository.ENTITY_TYPE, [naturalKeys.url, naturalKeys.localPath]);
    this.name = naturalKeys.name;
    this.namespace = naturalKeys.namespace;
    this.localPath = naturalKeys.localPath;
    this.url = naturalKeys.url;
    this.buildSystems = naturalKeys.buildSystems;
  }

  toCreateIntent(): RepositoryCreateIntent {
    return {
      id: this.id,
      name: this.name,
      namespace: this.namespace,
      localPath: this.localPath,
      url: this.url,
      buildSystems: this.buildSystems,
    };
  }
}

export interface RepositoryRecord extends DiscoveryEntityBase, RepositoryCreateIntent {}
