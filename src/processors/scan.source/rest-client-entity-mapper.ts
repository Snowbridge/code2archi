import type { ApplicationModuleRecord } from "../../discovery-model/entities/application-module.js";
import { RestClient } from "../../discovery-model/entities/rest-client.js";
import type { RepositoryRecord } from "../../discovery-model/entities/repository.js";
import type { ParsedRestClient } from "../../parsers/java/rest-client/rest-client-extractor.js";
import type { ParsedProgrammaticRestClient } from "../../parsers/java/rest-client/programmatic-http-client-extractor.js";
import { toRepoRelativePath } from "../../utils/repo-relative-path.js";

export function toDeclarativeRestClientEntity(
  parsed: ParsedRestClient,
  module: ApplicationModuleRecord,
  repository: RepositoryRecord,
  sourceFileAbsolutePath: string,
): RestClient {
  return new RestClient({
    applicationModuleId: module.id,
    name: parsed.name,
    fqcn: parsed.fqcn,
    dtoFqcn: parsed.dtoFqcn,
    endpoints: parsed.endpoints,
    tcpStackType: parsed.tcpStackType,
    discoveryStyle: "DECLARATIVE",
    clientFramework: parsed.clientFramework,
    extendedInterfaceFqcn: parsed.extendedInterfaceFqcn,
    sourceFile: toRepoRelativePath(repository.localPath, sourceFileAbsolutePath),
    ...(parsed.serviceName ? { serviceName: parsed.serviceName } : {}),
    ...(parsed.baseUrl ? { baseUrl: parsed.baseUrl } : {}),
  });
}

export function toProgrammaticRestClientEntity(
  parsed: ParsedProgrammaticRestClient,
  module: ApplicationModuleRecord,
  repository: RepositoryRecord,
  sourceFileAbsolutePath: string,
): RestClient {
  return new RestClient({
    applicationModuleId: module.id,
    name: parsed.name,
    fqcn: parsed.fqcn,
    dtoFqcn: [],
    endpoints: parsed.endpoints,
    tcpStackType: parsed.tcpStackType,
    discoveryStyle: "PROGRAMMATIC",
    clientFramework: parsed.clientFramework,
    extendedInterfaceFqcn: [],
    sourceFile: toRepoRelativePath(repository.localPath, sourceFileAbsolutePath),
    ...(parsed.baseUrl ? { baseUrl: parsed.baseUrl } : {}),
  });
}
