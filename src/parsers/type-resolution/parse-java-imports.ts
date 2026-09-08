import type { JavaKotlinImport } from "./types.js";

const JAVA_IMPORT_RE = /^\s*import\s+(?:static\s+)?([\w.]+|\S+\.\*)\s*;/;

export function parseJavaPackage(source: string): string {
  const match = source.match(/^\s*package\s+([\w.]+)\s*;/m);
  return match?.[1] ?? "";
}

export function parseJavaImports(source: string): readonly JavaKotlinImport[] {
  const imports: JavaKotlinImport[] = [];

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("import ")) {
      continue;
    }

    const match = JAVA_IMPORT_RE.exec(trimmed);
    if (match === null) {
      continue;
    }

    const target = match[1];
    if (target.endsWith(".*")) {
      imports.push({
        kind: "wildcard",
        qualifiedName: target.slice(0, -2),
      });
      continue;
    }

    imports.push({
      kind: "type",
      qualifiedName: target,
    });
  }

  return imports;
}
