import type { RepositoryCreateIntent } from "../../discovery-model/entities/repository.js";

export type ScanScopeInput = readonly string[];
export type ScanScopeOutput = readonly RepositoryCreateIntent[];
