import type { EsmImportBinding } from "./types.js";

const ESM_IMPORT_LINE_RE = /^\s*import\s+.+\s+from\s+(['"]).+?\1\s*;?\s*$/;
const ESM_SIDE_EFFECT_IMPORT_RE = /^\s*import\s+(['"]).+?\1\s*;?\s*$/;
const ESM_DEFAULT_IMPORT_RE = /^\s*import\s+(\w+)\s+from\s+/;
const ESM_DEFAULT_WITH_NAMED_IMPORT_RE = /^\s*import\s+(\w+)\s*,/;
const ESM_NAMESPACE_IMPORT_RE = /^\s*import\s+\*\s+as\s+(\w+)\s+from\s+/;
const NAMED_IMPORT_BLOCK_RE = /\{([^}]+)\}/;

function parseNamedBindings(namedBlock: string, fullImportLine: string): EsmImportBinding[] {
  const bindings: EsmImportBinding[] = [];

  for (const part of namedBlock.split(",")) {
    const trimmed = part.trim();
    if (trimmed === "") {
      continue;
    }

    const asMatch = /^(\w+)\s+as\s+(\w+)$/.exec(trimmed);
    if (asMatch !== null) {
      bindings.push({
        literalName: asMatch[2],
        fullImportLine,
      });
      continue;
    }

    const simpleMatch = /^(\w+)$/.exec(trimmed);
    if (simpleMatch !== null) {
      bindings.push({
        literalName: simpleMatch[1],
        fullImportLine,
      });
    }
  }

  return bindings;
}

export function parseEsmImports(source: string): readonly EsmImportBinding[] {
  const bindings: EsmImportBinding[] = [];

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("import ")) {
      continue;
    }

    if (ESM_SIDE_EFFECT_IMPORT_RE.test(trimmed) && !trimmed.includes(" from ")) {
      continue;
    }

    if (!ESM_IMPORT_LINE_RE.test(trimmed) && !ESM_DEFAULT_IMPORT_RE.test(trimmed)) {
      continue;
    }

    const namespaceMatch = ESM_NAMESPACE_IMPORT_RE.exec(trimmed);
    if (namespaceMatch !== null) {
      bindings.push({
        literalName: namespaceMatch[1],
        fullImportLine: trimmed,
      });
      continue;
    }

    const defaultWithNamedMatch = ESM_DEFAULT_WITH_NAMED_IMPORT_RE.exec(trimmed);
    if (defaultWithNamedMatch !== null) {
      bindings.push({
        literalName: defaultWithNamedMatch[1],
        fullImportLine: trimmed,
      });

      const namedInCombined = NAMED_IMPORT_BLOCK_RE.exec(trimmed);
      if (namedInCombined !== null) {
        bindings.push(...parseNamedBindings(namedInCombined[1], trimmed));
      }
      continue;
    }

    const namedMatch = NAMED_IMPORT_BLOCK_RE.exec(trimmed);
    if (namedMatch !== null) {
      bindings.push(...parseNamedBindings(namedMatch[1], trimmed));
      continue;
    }

    const defaultMatch = ESM_DEFAULT_IMPORT_RE.exec(trimmed);
    if (defaultMatch !== null && defaultMatch[1] !== "type") {
      bindings.push({
        literalName: defaultMatch[1],
        fullImportLine: trimmed,
      });
    }
  }

  return bindings;
}
