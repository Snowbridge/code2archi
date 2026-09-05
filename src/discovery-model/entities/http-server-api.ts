import type { DiscoveryEntityBase } from "./entity-base.js";
import { Entity } from "./entity.js";
import type { ConcurrencyModel } from "./http-api-concurrency-model.js";
import type { TypeReference } from "./type-reference.js";

export type HttpServerBindingStyle = "ANNOTATION" | "ROUTER" | "FILE_CONVENTION";

export interface HttpServerApiCreateIntent {
  readonly id: string;
  readonly applicationModuleId: string;
  readonly name: string;
  readonly symbolKey: string;
  readonly sourceFile: string;
  readonly endpoints: readonly string[];
  readonly payloadTypes: readonly TypeReference[];
  readonly concurrencyModel: ConcurrencyModel;
  readonly bindingStyle: HttpServerBindingStyle;
  readonly contractTypes: readonly TypeReference[];
  readonly baseTypeName?: string;
}

export interface HttpServerApiNaturalKeys {
  readonly applicationModuleId: string;
  readonly name: string;
  readonly symbolKey: string;
  readonly sourceFile: string;
  readonly endpoints: readonly string[];
  readonly payloadTypes: readonly TypeReference[];
  readonly concurrencyModel: ConcurrencyModel;
  readonly bindingStyle: HttpServerBindingStyle;
  readonly contractTypes: readonly TypeReference[];
  readonly baseTypeName?: string;
}

export class HttpServerApi extends Entity {
  private static readonly ENTITY_TYPE = "HttpServerApi" as const;

  readonly applicationModuleId: string;
  readonly name: string;
  readonly symbolKey: string;
  readonly sourceFile: string;
  readonly endpoints: readonly string[];
  readonly payloadTypes: readonly TypeReference[];
  readonly concurrencyModel: ConcurrencyModel;
  readonly bindingStyle: HttpServerBindingStyle;
  readonly contractTypes: readonly TypeReference[];
  readonly baseTypeName?: string;

  constructor(naturalKeys: HttpServerApiNaturalKeys) {
    super(HttpServerApi.ENTITY_TYPE, [
      naturalKeys.applicationModuleId,
      naturalKeys.symbolKey,
    ]);
    this.applicationModuleId = naturalKeys.applicationModuleId;
    this.name = naturalKeys.name;
    this.symbolKey = naturalKeys.symbolKey;
    this.sourceFile = naturalKeys.sourceFile;
    this.endpoints = naturalKeys.endpoints;
    this.payloadTypes = naturalKeys.payloadTypes;
    this.concurrencyModel = naturalKeys.concurrencyModel;
    this.bindingStyle = naturalKeys.bindingStyle;
    this.contractTypes = naturalKeys.contractTypes;
    if (naturalKeys.baseTypeName !== undefined) {
      this.baseTypeName = naturalKeys.baseTypeName;
    }
  }

  toCreateIntent(): HttpServerApiCreateIntent {
    return {
      id: this.id,
      applicationModuleId: this.applicationModuleId,
      name: this.name,
      symbolKey: this.symbolKey,
      sourceFile: this.sourceFile,
      endpoints: this.endpoints,
      payloadTypes: this.payloadTypes,
      concurrencyModel: this.concurrencyModel,
      bindingStyle: this.bindingStyle,
      contractTypes: this.contractTypes,
      ...(this.baseTypeName !== undefined ? { baseTypeName: this.baseTypeName } : {}),
    };
  }
}

export interface HttpServerApiRecord extends DiscoveryEntityBase, HttpServerApiCreateIntent {}
