import type { DiscoveryEntityBase } from "./entity-base.js";
import { Entity } from "./entity.js";

export interface RestClientCreateIntent {
  readonly id: string;
  readonly simpleName: string;
  readonly fqcn: string;
  readonly applicationModuleId: string;
  readonly fileName: string;
  readonly endpoints: readonly string[];
  readonly contractIds: readonly string[];
  readonly dataTypeIds: readonly string[];
}

export interface RestClientNaturalKeys {
  readonly applicationModuleId: string;
  readonly fqcn: string;
  readonly simpleName: string;
  readonly fileName: string;
  readonly endpoints: readonly string[];
  readonly contractIds: readonly string[];
  readonly dataTypeIds: readonly string[];
}

export class RestClient extends Entity {
  private static readonly ENTITY_TYPE = "RestClient" as const;

  readonly simpleName: string;
  readonly fqcn: string;
  readonly applicationModuleId: string;
  readonly fileName: string;
  readonly endpoints: readonly string[];
  readonly contractIds: readonly string[];
  readonly dataTypeIds: readonly string[];

  constructor(naturalKeys: RestClientNaturalKeys) {
    super(RestClient.ENTITY_TYPE, [naturalKeys.applicationModuleId, naturalKeys.fqcn]);
    this.simpleName = naturalKeys.simpleName;
    this.fqcn = naturalKeys.fqcn;
    this.applicationModuleId = naturalKeys.applicationModuleId;
    this.fileName = naturalKeys.fileName;
    this.endpoints = [...naturalKeys.endpoints];
    this.contractIds = [...naturalKeys.contractIds];
    this.dataTypeIds = [...naturalKeys.dataTypeIds];
  }

  static idFor(applicationModuleId: string, fqcn: string): string {
    return new RestClient({
      applicationModuleId,
      fqcn,
      simpleName: "",
      fileName: "",
      endpoints: [],
      contractIds: [],
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
      contractIds: this.contractIds,
      dataTypeIds: this.dataTypeIds,
    };
  }
}

export interface RestClientRecord extends DiscoveryEntityBase, RestClientCreateIntent {}

export const REST_CLIENT_MERGE_ARRAY_FIELDS = [
  "endpoints",
  "contractIds",
  "dataTypeIds",
] as const;

export const REST_CLIENT_SCALAR_FIELDS = [
  "simpleName",
  "fqcn",
  "applicationModuleId",
  "fileName",
] as const;
