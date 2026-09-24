import type { DiscoveryEntityBase } from "./entity-base.js";
import { Entity } from "./entity.js";

export interface RestControllerCreateIntent {
  readonly id: string;
  readonly simpleName: string;
  readonly fqcn: string;
  readonly applicationModuleId: string;
  readonly fileName: string;
  readonly endpoints: readonly string[];
  readonly dataTypeIds: readonly string[];
}

export interface RestControllerNaturalKeys {
  readonly applicationModuleId: string;
  readonly fqcn: string;
  readonly simpleName: string;
  readonly fileName: string;
  readonly endpoints: readonly string[];
  readonly dataTypeIds: readonly string[];
}

export class RestController extends Entity {
  private static readonly ENTITY_TYPE = "RestController" as const;

  readonly simpleName: string;
  readonly fqcn: string;
  readonly applicationModuleId: string;
  readonly fileName: string;
  readonly endpoints: readonly string[];
  readonly dataTypeIds: readonly string[];

  constructor(naturalKeys: RestControllerNaturalKeys) {
    super(RestController.ENTITY_TYPE, [naturalKeys.applicationModuleId, naturalKeys.fqcn]);
    this.simpleName = naturalKeys.simpleName;
    this.fqcn = naturalKeys.fqcn;
    this.applicationModuleId = naturalKeys.applicationModuleId;
    this.fileName = naturalKeys.fileName;
    this.endpoints = [...naturalKeys.endpoints];
    this.dataTypeIds = [...naturalKeys.dataTypeIds];
  }

  static idFor(applicationModuleId: string, fqcn: string): string {
    return new RestController({
      applicationModuleId,
      fqcn,
      simpleName: "",
      fileName: "",
      endpoints: [],
      dataTypeIds: [],
    }).id;
  }

  toCreateIntent(): RestControllerCreateIntent {
    return {
      id: this.id,
      simpleName: this.simpleName,
      fqcn: this.fqcn,
      applicationModuleId: this.applicationModuleId,
      fileName: this.fileName,
      endpoints: this.endpoints,
      dataTypeIds: this.dataTypeIds,
    };
  }
}

export interface RestControllerRecord extends DiscoveryEntityBase, RestControllerCreateIntent {}

export const REST_CONTROLLER_MERGE_ARRAY_FIELDS = ["endpoints", "dataTypeIds"] as const;

export const REST_CONTROLLER_SCALAR_FIELDS = [
  "simpleName",
  "fqcn",
  "applicationModuleId",
  "fileName",
] as const;
