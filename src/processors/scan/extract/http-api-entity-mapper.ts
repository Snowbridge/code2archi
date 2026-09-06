import type { ConcurrencyModel } from "../../../code-inventory/entities/http-api-concurrency-model.js";
import { HttpClientApi } from "../../../code-inventory/entities/http-client-api.js";
import { HttpServerApi } from "../../../code-inventory/entities/http-server-api.js";
import {
  toTypeReferencesFromQualifiedNames,
  toTypeReferencesFromSimpleNames,
} from "../../../code-inventory/entities/type-reference.js";

export interface HttpServerApiMappingInput {
  readonly applicationModuleId: string;
  readonly name: string;
  readonly symbolKey: string;
  readonly sourceFile: string;
  readonly endpoints: readonly string[];
  readonly payloadTypeNames: readonly string[];
  readonly concurrencyModel: ConcurrencyModel;
  readonly bindingStyle: "ANNOTATION" | "ROUTER" | "FILE_CONVENTION";
  readonly contractTypeNames: readonly string[];
  readonly baseTypeName?: string;
}

export interface HttpClientApiMappingInput {
  readonly applicationModuleId: string;
  readonly name: string;
  readonly symbolKey: string;
  readonly sourceFile: string;
  readonly endpoints: readonly string[];
  readonly payloadTypeNames: readonly string[];
  readonly concurrencyModel: ConcurrencyModel;
  readonly bindingStyle: "INTERFACE_MARKER" | "INLINE_HTTP";
  readonly inheritedContractTypeNames: readonly string[];
  readonly clientLibrary: string;
  readonly serviceName?: string;
  readonly baseUrl?: string;
}

export function toHttpServerApi(input: HttpServerApiMappingInput): HttpServerApi {
  return new HttpServerApi({
    applicationModuleId: input.applicationModuleId,
    name: input.name,
    symbolKey: input.symbolKey,
    sourceFile: input.sourceFile,
    endpoints: input.endpoints,
    payloadTypes: toTypeReferencesFromQualifiedNames(input.payloadTypeNames),
    concurrencyModel: input.concurrencyModel,
    bindingStyle: input.bindingStyle,
    contractTypes: toTypeReferencesFromQualifiedNames(input.contractTypeNames),
    ...(input.baseTypeName !== undefined ? { baseTypeName: input.baseTypeName } : {}),
  });
}

export function toHttpClientApi(input: HttpClientApiMappingInput): HttpClientApi {
  return new HttpClientApi({
    applicationModuleId: input.applicationModuleId,
    name: input.name,
    symbolKey: input.symbolKey,
    sourceFile: input.sourceFile,
    endpoints: input.endpoints,
    payloadTypes: input.payloadTypeNames.length > 0
      ? toTypeReferencesFromQualifiedNames(input.payloadTypeNames)
      : [],
    concurrencyModel: input.concurrencyModel,
    bindingStyle: input.bindingStyle,
    inheritedContractTypes: toTypeReferencesFromQualifiedNames(input.inheritedContractTypeNames),
    clientLibrary: input.clientLibrary,
    ...(input.serviceName !== undefined ? { serviceName: input.serviceName } : {}),
    ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
  });
}

export function toHttpServerApiFromSimplePayloadTypes(
  input: Omit<HttpServerApiMappingInput, "payloadTypeNames"> & {
    readonly payloadTypeNames: readonly string[];
  },
): HttpServerApi {
  return new HttpServerApi({
    applicationModuleId: input.applicationModuleId,
    name: input.name,
    symbolKey: input.symbolKey,
    sourceFile: input.sourceFile,
    endpoints: input.endpoints,
    payloadTypes: toTypeReferencesFromSimpleNames(input.payloadTypeNames),
    concurrencyModel: input.concurrencyModel,
    bindingStyle: input.bindingStyle,
    contractTypes: toTypeReferencesFromSimpleNames(input.contractTypeNames),
    ...(input.baseTypeName !== undefined ? { baseTypeName: input.baseTypeName } : {}),
  });
}
