import { readFileSync } from "node:fs";
import path from "node:path";
import type { ApplicationModuleRecord } from "../../../code-inventory/entities/application-module.js";
import type { RepositoryRecord } from "../../../code-inventory/entities/repository.js";
import { RestController } from "../../../code-inventory/entities/rest-controller.js";
import {
  tryExtractJvmFileModel,
  resolveTypeName,
} from "../../../parsers/jvm/extract-jvm-file.js";
import type { JvmMethodModel, JvmTypeModel } from "../../../parsers/jvm/types.js";
import type { JavaKotlinImport, JvmImportContext } from "../../../parsers/type-resolution/types.js";
import { parseJavaImports, parseJavaPackage } from "../../../parsers/type-resolution/parse-java-imports.js";
import { parseKotlinImports, parseKotlinPackage } from "../../../parsers/type-resolution/parse-kotlin-imports.js";
import { isJvmPrimitiveOrExcluded } from "./jvm-primitives.js";
import { RestDiscoveryIntentBuilder } from "./intent-builder.js";
import { listProductionJvmSources } from "./list-module-sources.js";
import { moduleProductionRoot } from "./module-binding.js";
import { productionSourceRelativePath } from "./source-scope.js";
import { unwrapJvmApiType } from "./type-unwrapping.js";
import { getLogger } from "../../../platform/logging/index.js";

const logger = getLogger("scan.extract.rest.jvm");

export interface JvmRestTypeHandler {
  isEligible(
    type: JvmTypeModel,
    importContext: JvmImportContext,
    language: "java" | "kotlin",
  ): boolean;
  extractEndpoints(type: JvmTypeModel): string[];
}

export function discoverJvmRestControllersForModule(
  repository: RepositoryRecord,
  module: ApplicationModuleRecord,
  handler: JvmRestTypeHandler,
): RestDiscoveryIntentBuilder {
  const builder = new RestDiscoveryIntentBuilder();
  const productionRoot = moduleProductionRoot(repository.localPath, module);
  const sourceFiles = listProductionJvmSources(productionRoot);

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
      if (!handler.isEligible(type, importContext, language)) {
        continue;
      }
      const contractIds = type.implementedInterfaces
        .map((interfaceName) => resolveTypeName(interfaceName, importContext, language))
        .map((fqcn) => builder.registerContract(fqcn));
      const dataTypeIds = collectDataTypeIds(type, importContext, language, builder);
      const endpoints = handler.extractEndpoints(type);
      const controller = new RestController({
        applicationModuleId: module.id,
        fqcn: type.fqcn,
        simpleName: type.simpleName,
        fileName,
        endpoints,
        dataTypeIds,
      });
      builder.registerController(controller.toCreateIntent());
      for (const contractId of contractIds) {
        builder.registerExtractAssignment(contractId, controller.id);
      }
    }
  }

  return builder;
}

function buildImportContext(source: string, language: "java" | "kotlin"): JvmImportContext {
  const packageName =
    language === "java" ? parseJavaPackage(source) : parseKotlinPackage(source);
  const imports: readonly JavaKotlinImport[] =
    language === "java" ? parseJavaImports(source) : parseKotlinImports(source);
  return { packageName, imports };
}

function collectDataTypeIds(
  type: JvmTypeModel,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
  builder: RestDiscoveryIntentBuilder,
): string[] {
  const ids = new Set<string>();
  for (const method of type.methods) {
    for (const typeText of [method.returnType, ...method.parameterTypes]) {
      for (const unwrapped of unwrapJvmApiType(typeText)) {
        if (isJvmPrimitiveOrExcluded(unwrapped)) {
          continue;
        }
        const fqcn = resolveTypeName(unwrapped, importContext, language);
        ids.add(builder.registerDataType(fqcn));
      }
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

export function collectDataTypesFromMethods(
  methods: readonly JvmMethodModel[],
  importContext: JvmImportContext,
  language: "java" | "kotlin",
  builder: RestDiscoveryIntentBuilder,
  moduleTypeIndex?: ReadonlyMap<string, string>,
): string[] {
  const ids = new Set<string>();
  for (const method of methods) {
    for (const typeText of [method.returnType, ...method.parameterTypes]) {
      for (const unwrapped of unwrapJvmApiType(typeText)) {
        if (isJvmPrimitiveOrExcluded(unwrapped)) {
          continue;
        }
        const fqcn = resolveDataTypeFqcn(unwrapped, importContext, language, moduleTypeIndex);
        ids.add(builder.registerDataType(fqcn));
      }
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function resolveDataTypeFqcn(
  typeText: string,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
  moduleTypeIndex?: ReadonlyMap<string, string>,
): string {
  if (moduleTypeIndex !== undefined) {
    const simpleName = typeSimpleName(typeText);
    const moduleFqcn = moduleTypeIndex.get(simpleName);
    if (moduleFqcn !== undefined) {
      return moduleFqcn;
    }
  }
  return resolveTypeName(typeText, importContext, language);
}

function typeSimpleName(typeText: string): string {
  const genericStart = typeText.indexOf("<");
  const head = genericStart >= 0 ? typeText.slice(0, genericStart) : typeText;
  const lastDot = head.lastIndexOf(".");
  return lastDot >= 0 ? head.slice(lastDot + 1) : head;
}

export function registerSyntheticController(
  builder: RestDiscoveryIntentBuilder,
  input: {
    applicationModuleId: string;
    fqcn: string;
    simpleName: string;
    fileName: string;
    endpoints: readonly string[];
  },
): void {
  const controller = new RestController({
    applicationModuleId: input.applicationModuleId,
    fqcn: input.fqcn,
    simpleName: input.simpleName,
    fileName: input.fileName,
    endpoints: input.endpoints,
    dataTypeIds: [],
  });
  builder.registerController(controller.toCreateIntent());
}

export function syntheticFqcn(kind: string, applicationModuleId: string, fileName: string, symbol?: string): string {
  const normalizedFile = fileName.replaceAll("\\", "/");
  if (symbol !== undefined && symbol.length > 0) {
    return `synthetic:${kind}:${applicationModuleId}:${normalizedFile}#${symbol}`;
  }
  return `synthetic:${kind}:${applicationModuleId}:${normalizedFile}`;
}

export function syntheticSimpleName(fqcn: string): string {
  if (fqcn.includes("#")) {
    return fqcn.slice(fqcn.lastIndexOf("#") + 1);
  }
  return fqcn.includes(":") ? fqcn.slice(fqcn.lastIndexOf(":") + 1) : fqcn;
}
