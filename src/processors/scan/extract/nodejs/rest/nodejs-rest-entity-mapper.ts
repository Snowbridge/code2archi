import path from "node:path";
import { NodejsRestClient } from "../../../../../discovery-model/entities/nodejs-rest-client.js";
import { NodejsRestController } from "../../../../../discovery-model/entities/nodejs-rest-controller.js";
import type { ApplicationModuleRecord } from "../../../../../discovery-model/entities/application-module.js";
import type { RepositoryRecord } from "../../../../../discovery-model/entities/repository.js";
import type { ParsedFunctionalRouter } from "../../../../../parsers/nodejs/functional-router-extractor.js";
import type { ParsedNestJsController } from "../../../../../parsers/nodejs/nestjs-controller-extractor.js";
import type { ParsedNextJsRouteFile } from "../../../../../parsers/nodejs/nextjs-app-router-extractor.js";
import type { ParsedProgrammaticHttpClient } from "../../../../../parsers/nodejs/programmatic-http-client-extractor.js";
import { buildQualifiedSymbol, toRepositoryRelativePath } from "../../../../../parsers/nodejs/nodejs-source-roots.js";

export function toFunctionalRouterControllerEntity(
  parsed: ParsedFunctionalRouter,
  module: ApplicationModuleRecord,
  repository: RepositoryRecord,
  absolutePath: string,
): NodejsRestController {
  const sourceFile = toRepositoryRelativePath(repository, absolutePath);
  const qualifiedSymbol = buildQualifiedSymbol(sourceFile, parsed.exportName);

  return new NodejsRestController({
    applicationModuleId: module.id,
    name: parsed.exportName,
    qualifiedSymbol,
    dtoTypes: parsed.dtoTypes,
    endpoints: parsed.endpoints,
    tcpStackType: parsed.tcpStackType,
    programmingModel: "FUNCTIONAL",
    serverFramework: parsed.serverFramework,
    implementsTypeNames: [],
    sourceFile,
  });
}

export function toNestJsControllerEntity(
  parsed: ParsedNestJsController,
  module: ApplicationModuleRecord,
  repository: RepositoryRecord,
  absolutePath: string,
): NodejsRestController {
  const sourceFile = toRepositoryRelativePath(repository, absolutePath);
  const qualifiedSymbol = buildQualifiedSymbol(sourceFile, parsed.className);

  return new NodejsRestController({
    applicationModuleId: module.id,
    name: parsed.className,
    qualifiedSymbol,
    dtoTypes: parsed.dtoTypes,
    endpoints: parsed.endpoints,
    tcpStackType: parsed.tcpStackType,
    programmingModel: "DECLARATIVE",
    serverFramework: "nestjs",
    implementsTypeNames: parsed.implementsTypeNames,
    sourceFile,
    ...(parsed.extendsTypeName ? { extendsTypeName: parsed.extendsTypeName } : {}),
  });
}

export function toNextJsRouteControllerEntity(
  parsed: ParsedNextJsRouteFile,
  module: ApplicationModuleRecord,
  repository: RepositoryRecord,
  absolutePath: string,
): NodejsRestController {
  const sourceFile = toRepositoryRelativePath(repository, absolutePath);
  const name = path.basename(path.dirname(absolutePath)) || "route";
  const qualifiedSymbol = sourceFile;

  return new NodejsRestController({
    applicationModuleId: module.id,
    name,
    qualifiedSymbol,
    dtoTypes: parsed.dtoTypes,
    endpoints: parsed.endpoints,
    tcpStackType: parsed.tcpStackType,
    programmingModel: "CONVENTION_BASED",
    serverFramework: "nextjs-app-router",
    implementsTypeNames: [],
    sourceFile,
  });
}

export function toProgrammaticClientEntity(
  parsed: ParsedProgrammaticHttpClient,
  module: ApplicationModuleRecord,
  repository: RepositoryRecord,
  absolutePath: string,
): NodejsRestClient {
  const sourceFile = toRepositoryRelativePath(repository, absolutePath);
  const qualifiedSymbol = buildQualifiedSymbol(sourceFile, parsed.exportName);

  return new NodejsRestClient({
    applicationModuleId: module.id,
    name: parsed.exportName,
    qualifiedSymbol,
    dtoTypes: [],
    endpoints: parsed.endpoints,
    tcpStackType: "NON_BLOCKING",
    discoveryStyle: "PROGRAMMATIC",
    clientFramework: parsed.clientFramework,
    extendsTypeNames: [],
    sourceFile,
    ...(parsed.baseUrl ? { baseUrl: parsed.baseUrl } : {}),
  });
}
