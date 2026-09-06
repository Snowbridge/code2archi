import path from "node:path";
import type { ApplicationModuleRecord } from "../../../../../code-inventory/entities/application-module.js";
import type { RepositoryRecord } from "../../../../../code-inventory/entities/repository.js";
import type { ParsedFunctionalRouter } from "../../../../../parsers/nodejs/functional-router-extractor.js";
import type { ParsedNestJsController } from "../../../../../parsers/nodejs/nestjs-controller-extractor.js";
import type { ParsedNextJsRouteFile } from "../../../../../parsers/nodejs/nextjs-app-router-extractor.js";
import type { ParsedProgrammaticHttpClient } from "../../../../../parsers/nodejs/programmatic-http-client-extractor.js";
import { buildQualifiedSymbol, toRepositoryRelativePath } from "../../../../../parsers/nodejs/nodejs-source-roots.js";
import {
  toHttpClientApi,
  toHttpServerApiFromSimplePayloadTypes,
} from "../../http-api-entity-mapper.js";

export function toFunctionalRouterControllerEntity(
  parsed: ParsedFunctionalRouter,
  module: ApplicationModuleRecord,
  repository: RepositoryRecord,
  absolutePath: string,
) {
  const sourceFile = toRepositoryRelativePath(repository, absolutePath);
  const symbolKey = buildQualifiedSymbol(sourceFile, parsed.exportName);

  return toHttpServerApiFromSimplePayloadTypes({
    applicationModuleId: module.id,
    name: parsed.exportName,
    symbolKey,
    endpoints: parsed.endpoints,
    concurrencyModel: parsed.tcpStackType,
    bindingStyle: "ROUTER",
    contractTypeNames: [],
    sourceFile,
    payloadTypeNames: parsed.dtoTypes,
  });
}

export function toNestJsControllerEntity(
  parsed: ParsedNestJsController,
  module: ApplicationModuleRecord,
  repository: RepositoryRecord,
  absolutePath: string,
) {
  const sourceFile = toRepositoryRelativePath(repository, absolutePath);
  const symbolKey = buildQualifiedSymbol(sourceFile, parsed.className);

  return toHttpServerApiFromSimplePayloadTypes({
    applicationModuleId: module.id,
    name: parsed.className,
    symbolKey,
    endpoints: parsed.endpoints,
    concurrencyModel: parsed.tcpStackType,
    bindingStyle: "ANNOTATION",
    contractTypeNames: parsed.implementsTypeNames,
    sourceFile,
    payloadTypeNames: parsed.dtoTypes,
    ...(parsed.extendsTypeName ? { baseTypeName: parsed.extendsTypeName } : {}),
  });
}

export function toNextJsRouteControllerEntity(
  parsed: ParsedNextJsRouteFile,
  module: ApplicationModuleRecord,
  repository: RepositoryRecord,
  absolutePath: string,
) {
  const sourceFile = toRepositoryRelativePath(repository, absolutePath);
  const name = path.basename(path.dirname(absolutePath)) || "route";
  const symbolKey = sourceFile;

  return toHttpServerApiFromSimplePayloadTypes({
    applicationModuleId: module.id,
    name,
    symbolKey,
    endpoints: parsed.endpoints,
    concurrencyModel: parsed.tcpStackType,
    bindingStyle: "FILE_CONVENTION",
    contractTypeNames: [],
    sourceFile,
    payloadTypeNames: parsed.dtoTypes,
  });
}

export function toProgrammaticClientEntity(
  parsed: ParsedProgrammaticHttpClient,
  module: ApplicationModuleRecord,
  repository: RepositoryRecord,
  absolutePath: string,
) {
  const sourceFile = toRepositoryRelativePath(repository, absolutePath);
  const symbolKey = buildQualifiedSymbol(sourceFile, parsed.exportName);

  return toHttpClientApi({
    applicationModuleId: module.id,
    name: parsed.exportName,
    symbolKey,
    endpoints: parsed.endpoints,
    payloadTypeNames: [],
    concurrencyModel: "NON_BLOCKING",
    bindingStyle: "INLINE_HTTP",
    inheritedContractTypeNames: [],
    clientLibrary: parsed.clientFramework,
    sourceFile,
    ...(parsed.baseUrl ? { baseUrl: parsed.baseUrl } : {}),
  });
}
