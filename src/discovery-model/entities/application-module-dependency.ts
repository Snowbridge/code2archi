import type { DiscoveryEntityBase } from "./entity-base.js";

export interface ApplicationModuleDependencyCreateIntent {
  readonly id: string;
  readonly parentId: string;
  readonly groupId: string;
  readonly artifactId: string;
  readonly version: string;
}

export interface ApplicationModuleDependency
  extends DiscoveryEntityBase,
    ApplicationModuleDependencyCreateIntent {}
