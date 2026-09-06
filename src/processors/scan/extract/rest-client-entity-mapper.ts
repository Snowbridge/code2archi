import type { ApplicationModuleRecord } from "../../../code-inventory/entities/application-module.js";
import type { RepositoryRecord } from "../../../code-inventory/entities/repository.js";
import type { ParsedRestClient } from "../../../parsers/java/rest-client/rest-client-extractor.js";
import type { ParsedProgrammaticRestClient } from "../../../parsers/java/rest-client/programmatic-http-client-extractor.js";
import { toRepoRelativePath } from "../../../utils/repo-relative-path.js";
import { toHttpClientApi } from "./http-api-entity-mapper.js";

export function toDeclarativeRestClientEntity(
  parsed: ParsedRestClient,
  module: ApplicationModuleRecord,
  repository: RepositoryRecord,
  sourceFileAbsolutePath: string,
) {
  return toHttpClientApi({
    applicationModuleId: module.id,
    name: parsed.name,
    symbolKey: parsed.fqcn,
    payloadTypeNames: parsed.dtoFqcn,
    endpoints: parsed.endpoints,
    concurrencyModel: parsed.tcpStackType,
    bindingStyle: "INTERFACE_MARKER",
    clientLibrary: parsed.clientFramework,
    inheritedContractTypeNames: parsed.extendedInterfaceFqcn,
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
) {
  return toHttpClientApi({
    applicationModuleId: module.id,
    name: parsed.name,
    symbolKey: parsed.fqcn,
    payloadTypeNames: [...parsed.dtoFqcn],
    endpoints: parsed.endpoints,
    concurrencyModel: parsed.tcpStackType,
    bindingStyle: "INLINE_HTTP",
    clientLibrary: parsed.clientFramework,
    inheritedContractTypeNames: [...parsed.inheritedContractTypeNames],
    sourceFile: toRepoRelativePath(repository.localPath, sourceFileAbsolutePath),
    ...(parsed.baseUrl ? { baseUrl: parsed.baseUrl } : {}),
  });
}
