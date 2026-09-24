import type { DiscoveryEntityBase } from "./entity-base.js";
import { Entity } from "./entity.js";

export type RestClientOrigin = "source" | "supplement";

export interface RestClientCreateIntent {
  readonly id: string;
  readonly simpleName: string;
  readonly fqcn: string;
  readonly applicationModuleId: string;
  readonly fileName: string;
  readonly endpoints: readonly string[];
  readonly dataTypeIds: readonly string[];
  readonly origin: RestClientOrigin;
}

export interface RestClientNaturalKeys {
  readonly applicationModuleId: string;
  readonly fqcn: string;
  readonly simpleName: string;
  readonly fileName: string;
  readonly endpoints: readonly string[];
  readonly dataTypeIds: readonly string[];
  readonly origin?: RestClientOrigin;
}

export class RestClient extends Entity {
  private static readonly ENTITY_TYPE = "RestClient" as const;

  readonly simpleName: string;
  readonly fqcn: string;
  readonly applicationModuleId: string;
  readonly fileName: string;
  readonly endpoints: readonly string[];
  readonly dataTypeIds: readonly string[];
  readonly origin: RestClientOrigin;

  constructor(naturalKeys: RestClientNaturalKeys) {
    super(RestClient.ENTITY_TYPE, [naturalKeys.applicationModuleId, naturalKeys.fqcn]);
    this.simpleName = naturalKeys.simpleName;
    this.fqcn = naturalKeys.fqcn;
    this.applicationModuleId = naturalKeys.applicationModuleId;
    this.fileName = naturalKeys.fileName;
    this.endpoints = [...naturalKeys.endpoints];
    this.dataTypeIds = [...naturalKeys.dataTypeIds];
    this.origin = naturalKeys.origin ?? "source";
  }

  static idFor(applicationModuleId: string, fqcn: string): string {
    return new RestClient({
      applicationModuleId,
      fqcn,
      simpleName: "",
      fileName: "",
      endpoints: [],
      dataTypeIds: [],
    }).id;
  }

  toCreateIntent(): RestClientCreateIntent {
    return {
      id: this.id,
      simpleName: this.simpleName,
      fqcn: this.fqcn,
      applicationModuleId: this.applicationModuleId,
      fileName: this.fileName,
      endpoints: this.endpoints,
      dataTypeIds: this.dataTypeIds,
      origin: this.origin,
    };
  }
}

export interface RestClientRecord extends DiscoveryEntityBase, RestClientCreateIntent {}

export const REST_CLIENT_MERGE_ARRAY_FIELDS = ["endpoints", "dataTypeIds"] as const;

export const REST_CLIENT_SCALAR_FIELDS = [
  "simpleName",
  "fqcn",
  "applicationModuleId",
  "fileName",
  "origin",
] as const;
