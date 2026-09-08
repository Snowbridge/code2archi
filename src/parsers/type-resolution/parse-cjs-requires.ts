import type { CjsImportBinding } from "./types.js";

const CJS_REQUIRE_LINE_RE =
  /^\s*(?:const|let|var)\s+(.+?)\s*=\s*require\s*\(\s*(['"])(.+?)\2\s*\)\s*;?\s*$/;

function parseDestructuredNames(lhs: string): string[] {
  const trimmed = lhs.trim();
  const braceMatch = /^\{([^}]+)\}$/.exec(trimmed);
  if (braceMatch === null) {
    return [];
  }

  const names: string[] = [];
  for (const part of braceMatch[1].split(",")) {
    const segment = part.trim();
    if (segment === "") {
      continue;
    }

    const asMatch = /^(\w+)\s*:\s*(\w+)$/.exec(segment);
    if (asMatch !== null) {
      names.push(asMatch[2]);
      continue;
    }

    const renameMatch = /^(\w+)\s+as\s+(\w+)$/.exec(segment);
    if (renameMatch !== null) {
      names.push(renameMatch[2]);
      continue;
    }

    const simpleMatch = /^(\w+)$/.exec(segment);
    if (simpleMatch !== null) {
      names.push(simpleMatch[1]);
    }
  }

  return names;
}

export function parseCjsRequires(source: string): readonly CjsImportBinding[] {
  const bindings: CjsImportBinding[] = [];

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = CJS_REQUIRE_LINE_RE.exec(trimmed);
    if (match === null) {
      continue;
    }

    const lhs = match[1].trim();
    const destructured = parseDestructuredNames(lhs);
    if (destructured.length > 0) {
      for (const literalName of destructured) {
        bindings.push({ literalName, fullImportLine: trimmed });
      }
      continue;
    }

    const simpleMatch = /^(\w+)$/.exec(lhs);
    if (simpleMatch !== null) {
      bindings.push({
        literalName: simpleMatch[1],
        fullImportLine: trimmed,
      });
    }
  }

  return bindings;
}
