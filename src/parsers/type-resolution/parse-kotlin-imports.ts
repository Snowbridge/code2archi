import type { JavaKotlinImport } from "./types.js";

const KOTLIN_IMPORT_RE =
  /^\s*import\s+(?:[\w.]+\.)?[\w.*]+(?:\s+as\s+(\w+))?\s*(?:;)?\s*$/;

export function parseKotlinPackage(source: string): string {
  const match = source.match(/^\s*package\s+([\w.]+)\s*(?:;)?\s*$/m);
  return match?.[1] ?? "";
}

function parseKotlinImportTarget(rawTarget: string): JavaKotlinImport | undefined {
  const asIndex = rawTarget.lastIndexOf(" as ");
  if (asIndex !== -1) {
    const qualifiedPart = rawTarget.slice(0, asIndex).trim();
    const alias = rawTarget.slice(asIndex + 4).trim();

    if (qualifiedPart.endsWith(".*")) {
      return {
        kind: "wildcard",
        qualifiedName: qualifiedPart.slice(0, -2),
        alias,
      };
    }

    return {
      kind: "type",
      qualifiedName: qualifiedPart,
      alias,
    };
  }

  if (rawTarget.endsWith(".*")) {
    return {
      kind: "wildcard",
      qualifiedName: rawTarget.slice(0, -2),
    };
  }

  return {
    kind: "type",
    qualifiedName: rawTarget,
  };
}

export function parseKotlinImports(source: string): readonly JavaKotlinImport[] {
  const imports: JavaKotlinImport[] = [];

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("import ")) {
      continue;
    }

    if (!KOTLIN_IMPORT_RE.test(trimmed)) {
      continue;
    }

    const body = trimmed
      .replace(/^\s*import\s+/, "")
      .replace(/;?\s*$/, "")
      .trim();

    const parsed = parseKotlinImportTarget(body);
    if (parsed !== undefined) {
      imports.push(parsed);
    }
  }

  return imports;
}
