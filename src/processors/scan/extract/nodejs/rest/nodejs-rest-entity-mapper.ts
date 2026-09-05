import path from "node:path";
import { RestClient } from "../../../../../discovery-model/entities/rest-client.js";
import { RestController } from "../../../../../discovery-model/entities/rest-controller.js";
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
): RestController {
  const sourceFile = toRepositoryRelativePath(repository, absolutePath);
  const fqcn = buildQualifiedSymbol(sourceFile, parsed.exportName);

  return new RestController({
    applicationModuleId: module.id,
    name: parsed.exportName,
    fqcn,
    dtoFqcn: parsed.dtoTypes,
    endpoints: parsed.endpoints,
    tcpStackType: parsed.tcpStackType,
    programmingModel: "FUNCTIONAL",
    implementedInterfaceFqcn: [],
    sourceFile,
  });
}

export function toNestJsControllerEntity(
  parsed: ParsedNestJsController,
  module: ApplicationModuleRecord,
  repository: RepositoryRecord,
  absolutePath: string,
): RestController {
  const sourceFile = toRepositoryRelativePath(repository, absolutePath);
  const fqcn = buildQualifiedSymbol(sourceFile, parsed.className);

  return new RestController({
    applicationModuleId: module.id,
    name: parsed.className,
    fqcn,
    dtoFqcn: parsed.dtoTypes,
    endpoints: parsed.endpoints,
    tcpStackType: parsed.tcpStackType,
    programmingModel: "DECLARATIVE",
    implementedInterfaceFqcn: parsed.implementsTypeNames,
    sourceFile,
    ...(parsed.extendsTypeName ? { baseClassFqcn: parsed.extendsTypeName } : {}),
  });
}

export function toNextJsRouteControllerEntity(
  parsed: ParsedNextJsRouteFile,
  module: ApplicationModuleRecord,
  repository: RepositoryRecord,
  absolutePath: string,
): RestController {
  const sourceFile = toRepositoryRelativePath(repository, absolutePath);
  const name = path.basename(path.dirname(absolutePath)) || "route";
  const fqcn = sourceFile;

  return new RestController({
    applicationModuleId: module.id,
    name,
    fqcn,
    dtoFqcn: parsed.dtoTypes,
    endpoints: parsed.endpoints,
    tcpStackType: parsed.tcpStackType,
    programmingModel: "CONVENTION_BASED",
    implementedInterfaceFqcn: [],
    sourceFile,
  });
}

export function toProgrammaticClientEntity(
  parsed: ParsedProgrammaticHttpClient,
  module: ApplicationModuleRecord,
  repository: RepositoryRecord,
  absolutePath: string,
): RestClient {
  const sourceFile = toRepositoryRelativePath(repository, absolutePath);
  const fqcn = buildQualifiedSymbol(sourceFile, parsed.exportName);

  return new RestClient({
    applicationModuleId: module.id,
    name: parsed.exportName,
    fqcn,
    dtoFqcn: [],
    endpoints: parsed.endpoints,
    tcpStackType: "NON_BLOCKING",
    discoveryStyle: "PROGRAMMATIC",
    clientFramework: parsed.clientFramework,
    extendedInterfaceFqcn: [],
    sourceFile,
    ...(parsed.baseUrl ? { baseUrl: parsed.baseUrl } : {}),
  });
}
