import { FqcnResolutionError } from "./errors.js";
import {
  findPartialImportMatch,
  typeImportsMatchingAlias,
  typeImportsMatchingSimpleName,
  wildcardImports,
} from "./jvm-import-utils.js";
import type { JvmImportContext } from "./types.js";

export interface ResolveJvmFqcnOptions {
  readonly implicitJavaLang: boolean;
}

const JAVA_LANG_TYPES = new Set([
  "Boolean",
  "Byte",
  "Character",
  "Class",
  "Double",
  "Enum",
  "Float",
  "Integer",
  "Long",
  "Number",
  "Object",
  "Short",
  "String",
  "Void",
]);

function resolveQualifiedName(literalName: string, context: JvmImportContext): string {
  const dotIndex = literalName.indexOf(".");
  const head = literalName.slice(0, dotIndex);
  const remainder = literalName.slice(dotIndex + 1);

  const partialMatch = findPartialImportMatch(context.imports, head);
  if (partialMatch === undefined) {
    throw new FqcnResolutionError(literalName, "unresolved");
  }

  return `${partialMatch.qualifiedName}.${remainder}`;
}

function resolveSimpleName(
  literalName: string,
  context: JvmImportContext,
  options: ResolveJvmFqcnOptions,
): string {
  const exactMatches = typeImportsMatchingSimpleName(context.imports, literalName);
  if (exactMatches.length > 1) {
    throw new FqcnResolutionError(literalName, "ambiguous_import");
  }

  if (exactMatches.length === 1) {
    return exactMatches[0].qualifiedName;
  }

  const aliasMatches = typeImportsMatchingAlias(context.imports, literalName);
  if (aliasMatches.length > 1) {
    throw new FqcnResolutionError(literalName, "ambiguous_import");
  }

  if (aliasMatches.length === 1) {
    return aliasMatches[0].qualifiedName;
  }

  const wildcards = wildcardImports(context.imports);
  if (wildcards.length === 1) {
    return `${wildcards[0].qualifiedName}.${literalName}`;
  }

  if (wildcards.length > 1) {
    throw new FqcnResolutionError(literalName, "unresolved");
  }

  if (context.packageName !== "") {
    return `${context.packageName}.${literalName}`;
  }

  if (options.implicitJavaLang && JAVA_LANG_TYPES.has(literalName)) {
    return `java.lang.${literalName}`;
  }

  throw new FqcnResolutionError(literalName, "unresolved");
}

export function resolveJvmFqcn(
  literalName: string,
  context: JvmImportContext,
  options: ResolveJvmFqcnOptions,
): string {
  if (literalName.includes(".")) {
    return resolveQualifiedName(literalName, context);
  }

  return resolveSimpleName(literalName, context, options);
}
