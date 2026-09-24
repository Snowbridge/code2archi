import { readFileSync } from "node:fs";
import type { ApplicationModuleRecord } from "../../../../code-inventory/entities/application-module.js";
import type { RepositoryRecord } from "../../../../code-inventory/entities/repository.js";
import { RestClient } from "../../../../code-inventory/entities/rest-client.js";
import {
  resolveTypeName,
  tryExtractJvmFileModel,
} from "../../../../parsers/jvm/extract-jvm-file.js";
import type { JavaKotlinImport, JvmImportContext } from "../../../../parsers/type-resolution/types.js";
import { parseJavaImports, parseJavaPackage } from "../../../../parsers/type-resolution/parse-java-imports.js";
import { parseKotlinImports, parseKotlinPackage } from "../../../../parsers/type-resolution/parse-kotlin-imports.js";
import {
  collectDataTypesFromMethods,
} from "../discover-jvm-rest-module.js";
import { RestDiscoveryIntentBuilder } from "../intent-builder.js";
import { listProductionJvmSources } from "../list-module-sources.js";
import { moduleProductionRoot } from "../module-binding.js";
import { productionSourceRelativePath } from "../source-scope.js";
import { getLogger } from "../../../../platform/logging/index.js";
import { isDeclarativeRestClient } from "./declarative-exclusions.js";
import { extractProgrammaticEndpoints } from "./endpoint-extraction.js";
import {
  extractClassBodyText,
  extractClassMethodBodies,
} from "./jvm-class-body.js";
import { typeHasHttpCallSiteInOwnMethods } from "./http-stack-call-sites.js";

const logger = getLogger("scan.extract.rest.clients");

export function discoverJvmRestClientsForModule(
  repository: RepositoryRecord,
  module: ApplicationModuleRecord,
): RestDiscoveryIntentBuilder {
  const builder = new RestDiscoveryIntentBuilder();
  const productionRoot = moduleProductionRoot(repository.localPath, module);
  const sourceFiles = listProductionJvmSources(productionRoot);
  const moduleTypeIndex = buildModuleTypeIndex(sourceFiles);

  for (const absolutePath of sourceFiles) {
    const fileName = productionSourceRelativePath(absolutePath, repository.localPath);
    const language = absolutePath.endsWith(".java") ? "java" : "kotlin";
    const source = readFileSync(absolutePath, "utf8");
    const fileModel = tryExtractJvmFileModel(source, language);
    if (fileModel === undefined) {
      logger.warn("skipped JVM source file: tree-sitter parse failed", {
        fileName,
        language,
      });
      continue;
    }
    const importContext = buildImportContext(source, language);

    for (const type of fileModel.types) {
      if (isDeclarativeRestClient(type)) {
        continue;
      }

      const methodBodies = extractClassMethodBodies(source, language, type.simpleName);
      if (!typeHasHttpCallSiteInOwnMethods(methodBodies)) {
        continue;
      }

      const classBodyText =
        extractClassBodyText(source, language, type.simpleName) ?? source;
      const contractIds = [...new Set(type.implementedInterfaces)]
        .map((interfaceName) =>
          resolveContractFqcn(interfaceName, importContext, language, moduleTypeIndex),
        )
        .map((fqcn) => builder.registerContract(fqcn));
      const dataTypeIds = collectDataTypesFromMethods(
        type.methods,
        importContext,
        language,
        builder,
        moduleTypeIndex,
      );
      const endpoints = extractProgrammaticEndpoints(classBodyText, methodBodies, language);
      const client = new RestClient({
        applicationModuleId: module.id,
        fqcn: type.fqcn,
        simpleName: type.simpleName,
        fileName,
        endpoints,
        dataTypeIds,
      });
      builder.registerClient(client.toCreateIntent());
      for (const contractId of contractIds) {
        builder.registerExtractAssignment(contractId, client.id);
      }
    }
  }

  return builder;
}

function buildModuleTypeIndex(sourceFiles: readonly string[]): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const absolutePath of sourceFiles) {
    const language = absolutePath.endsWith(".java") ? "java" : "kotlin";
    const source = readFileSync(absolutePath, "utf8");
    const fileModel = tryExtractJvmFileModel(source, language);
    if (fileModel === undefined) {
      continue;
    }
    for (const type of fileModel.types) {
      index.set(type.simpleName, type.fqcn);
    }
  }
  return index;
}

function resolveContractFqcn(
  interfaceName: string,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
  moduleTypeIndex: ReadonlyMap<string, string>,
): string {
  const moduleTypeFqcn = moduleTypeIndex.get(interfaceName);
  if (moduleTypeFqcn !== undefined) {
    return moduleTypeFqcn;
  }
  return resolveTypeName(interfaceName, importContext, language);
}

function buildImportContext(source: string, language: "java" | "kotlin"): JvmImportContext {
  const packageName =
    language === "java" ? parseJavaPackage(source) : parseKotlinPackage(source);
  const imports: readonly JavaKotlinImport[] =
    language === "java" ? parseJavaImports(source) : parseKotlinImports(source);
  return { packageName, imports };
}
