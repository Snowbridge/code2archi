import type { DiscoveryEntityBase } from "./entity-base.js";

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

export interface ApplicationModule
  extends DiscoveryEntityBase,
    ApplicationModuleCreateIntent {}
