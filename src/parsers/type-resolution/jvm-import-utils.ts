import type { JavaKotlinImport } from "./types.js";

export function lastQualifiedSegment(qualifiedName: string): string {
  const lastDot = qualifiedName.lastIndexOf(".");
  if (lastDot === -1) {
    return qualifiedName;
  }

  return qualifiedName.slice(lastDot + 1);
}

export function wildcardImports(imports: readonly JavaKotlinImport[]): readonly JavaKotlinImport[] {
  return imports.filter((entry) => entry.kind === "wildcard");
}

export function typeImportsMatchingSimpleName(
  imports: readonly JavaKotlinImport[],
  simpleName: string,
): readonly JavaKotlinImport[] {
  return imports.filter(
    (entry) => entry.kind === "type" && lastQualifiedSegment(entry.qualifiedName) === simpleName,
  );
}

export function typeImportsMatchingAlias(
  imports: readonly JavaKotlinImport[],
  alias: string,
): readonly JavaKotlinImport[] {
  return imports.filter((entry) => entry.kind === "type" && entry.alias === alias);
}

export function findPartialImportMatch(
  imports: readonly JavaKotlinImport[],
  head: string,
): JavaKotlinImport | undefined {
  for (const entry of imports) {
    if (entry.kind !== "type") {
      continue;
    }

    if (entry.alias === head || lastQualifiedSegment(entry.qualifiedName) === head) {
      return entry;
    }
  }

  return undefined;
}
