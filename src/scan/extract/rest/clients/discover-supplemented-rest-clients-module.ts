import { readFileSync } from "node:fs";
import type { ApplicationModuleRecord } from "../../../../code-inventory/entities/application-module.js";
import type { RepositoryRecord } from "../../../../code-inventory/entities/repository.js";
import { RestClient } from "../../../../code-inventory/entities/rest-client.js";
import { parseJavaImports, parseJavaPackage } from "../../../../parsers/type-resolution/parse-java-imports.js";
import { parseKotlinImports, parseKotlinPackage } from "../../../../parsers/type-resolution/parse-kotlin-imports.js";
import type { JavaKotlinImport, JvmImportContext } from "../../../../parsers/type-resolution/types.js";
import { RestDiscoveryIntentBuilder } from "../intent-builder.js";
import { listProductionJvmSources } from "../list-module-sources.js";
import { moduleProductionRoot } from "../module-binding.js";
import {
  collectDeclaredTypeLiterals,
  resolveDeclaredTypeCandidates,
} from "./declared-type-literals.js";
import type { SupplementedRestClientEntry } from "./supplement-rest-client-file.js";

export function discoverSupplementedRestClientsForModule(
  repository: RepositoryRecord,
  module: ApplicationModuleRecord,
  entriesByFqcn: ReadonlyMap<string, SupplementedRestClientEntry>,
): RestDiscoveryIntentBuilder {
  const builder = new RestDiscoveryIntentBuilder();
  const productionRoot = moduleProductionRoot(repository.localPath, module);
  const sourceFiles = listProductionJvmSources(productionRoot);
  const usedFqcns = collectUsedClientFqcns(sourceFiles, entriesByFqcn);

  for (const fqcn of usedFqcns) {
    const entry = entriesByFqcn.get(fqcn);
    if (entry === undefined) {
      continue;
    }
    const targetId = RestClient.idFor(module.id, fqcn);
    const sourceId = RestClient.idFor(entry.applicationModuleId, fqcn);
    if (targetId === sourceId) {
      // The client belongs to its own origin module per the supplement — already present.
      continue;
    }
    const client = new RestClient({
      applicationModuleId: module.id,
      fqcn,
      simpleName: entry.simpleName ?? "",
      fileName: entry.fileName ?? "",
      endpoints: entry.endpoints ?? [],
      contractIds: entry.contractIds ?? [],
      dataTypeIds: entry.dataTypeIds ?? [],
    });
    builder.registerClient(client.toCreateIntent());
  }

  return builder;
}

function collectUsedClientFqcns(
  sourceFiles: readonly string[],
  entriesByFqcn: ReadonlyMap<string, SupplementedRestClientEntry>,
): string[] {
  const used = new Set<string>();
  for (const absolutePath of sourceFiles) {
    const language = absolutePath.endsWith(".java") ? "java" : "kotlin";
    const source = readFileSync(absolutePath, "utf8");
    const literals = collectDeclaredTypeLiterals(source, language);
    if (literals === undefined) {
      continue;
    }
    const importContext = buildImportContext(source, language);
    for (const candidate of resolveDeclaredTypeCandidates(literals, importContext, language)) {
      if (entriesByFqcn.has(candidate)) {
        used.add(candidate);
      }
    }
  }
  return [...used].sort((a, b) => a.localeCompare(b));
}

function buildImportContext(source: string, language: "java" | "kotlin"): JvmImportContext {
  const packageName =
    language === "java" ? parseJavaPackage(source) : parseKotlinPackage(source);
  const imports: readonly JavaKotlinImport[] =
    language === "java" ? parseJavaImports(source) : parseKotlinImports(source);
  return { packageName, imports };
}