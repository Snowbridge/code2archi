import type { DiscoveryEntityBase } from "./entity-base.js";
import { Entity } from "./entity.js";
import type { ConcurrencyModel } from "./http-api-concurrency-model.js";
import type { TypeReference } from "./type-reference.js";

export type HttpClientBindingStyle = "INTERFACE_MARKER" | "INLINE_HTTP";

export interface HttpClientApiCreateIntent {
  readonly id: string;
  readonly applicationModuleId: string;
  readonly name: string;
  readonly symbolKey: string;
  readonly sourceFile: string;
  readonly endpoints: readonly string[];
  readonly payloadTypes: readonly TypeReference[];
  readonly concurrencyModel: ConcurrencyModel;
  readonly bindingStyle: HttpClientBindingStyle;
  readonly inheritedContractTypes: readonly TypeReference[];
  readonly clientLibrary: string;
  readonly serviceName?: string;
  readonly baseUrl?: string;
}

export interface HttpClientApiNaturalKeys {
  readonly applicationModuleId: string;
  readonly name: string;
  readonly symbolKey: string;
  readonly sourceFile: string;
  readonly endpoints: readonly string[];
  readonly payloadTypes: readonly TypeReference[];
  readonly concurrencyModel: ConcurrencyModel;
  readonly bindingStyle: HttpClientBindingStyle;
  readonly inheritedContractTypes: readonly TypeReference[];
  readonly clientLibrary: string;
  readonly serviceName?: string;
  readonly baseUrl?: string;
}

export class HttpClientApi extends Entity {
  private static readonly ENTITY_TYPE = "HttpClientApi" as const;

  readonly applicationModuleId: string;
  readonly name: string;
  readonly symbolKey: string;
  readonly sourceFile: string;
  readonly endpoints: readonly string[];
  readonly payloadTypes: readonly TypeReference[];
  readonly concurrencyModel: ConcurrencyModel;
  readonly bindingStyle: HttpClientBindingStyle;
  readonly inheritedContractTypes: readonly TypeReference[];
  readonly clientLibrary: string;
  readonly serviceName?: string;
  readonly baseUrl?: string;

  constructor(naturalKeys: HttpClientApiNaturalKeys) {
    super(HttpClientApi.ENTITY_TYPE, [naturalKeys.applicationModuleId, naturalKeys.symbolKey]);
    this.applicationModuleId = naturalKeys.applicationModuleId;
    this.name = naturalKeys.name;
    this.symbolKey = naturalKeys.symbolKey;
    this.sourceFile = naturalKeys.sourceFile;
    this.endpoints = naturalKeys.endpoints;
    this.payloadTypes = naturalKeys.payloadTypes;
    this.concurrencyModel = naturalKeys.concurrencyModel;
    this.bindingStyle = naturalKeys.bindingStyle;
    this.inheritedContractTypes = naturalKeys.inheritedContractTypes;
    this.clientLibrary = naturalKeys.clientLibrary;
    if (naturalKeys.serviceName !== undefined) {
      this.serviceName = naturalKeys.serviceName;
    }
    if (naturalKeys.baseUrl !== undefined) {
      this.baseUrl = naturalKeys.baseUrl;
    }
  }

  toCreateIntent(): HttpClientApiCreateIntent {
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
      inheritedContractTypes: this.inheritedContractTypes,
      clientLibrary: this.clientLibrary,
      ...(this.serviceName !== undefined ? { serviceName: this.serviceName } : {}),
      ...(this.baseUrl !== undefined ? { baseUrl: this.baseUrl } : {}),
    };
  }
}

export interface HttpClientApiRecord extends DiscoveryEntityBase, HttpClientApiCreateIntent {}
