import type { DiscoveryEntityBase } from "./entity-base.js";

export interface RepositoryCreateIntent {
  readonly id: string;
  readonly name: string;
  readonly namespace: string;
  readonly localPath: string;
  readonly url: string;
  readonly buildSystems: readonly string[];
}

export interface Repository extends DiscoveryEntityBase, RepositoryCreateIntent {}
