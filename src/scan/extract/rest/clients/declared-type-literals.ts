import type { SyntaxNode } from "tree-sitter";
import { parseJvmSource } from "../../../../parsers/jvm/jvm-parser.js";
import { resolveJavaFqcn } from "../../../../parsers/type-resolution/resolve-java-fqcn.js";
import { resolveKotlinFqcn } from "../../../../parsers/type-resolution/resolve-kotlin-fqcn.js";
import type { JvmImportContext } from "../../../../parsers/type-resolution/types.js";

const IDENTIFIER_PATTERN = /[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/g;

/**
 * Collects declared type literals from a JVM source file:
 * - Java: types of `field_declaration` and `local_variable_declaration`.
 * - Kotlin: types of `property_declaration` and `local_variable_declaration`.
 *
 * Method parameters, return types and other references are intentionally not
 * collected. Returns `undefined` when the source cannot be parsed.
 */
export function collectDeclaredTypeLiterals(
  source: string,
  language: "java" | "kotlin",
): readonly string[] | undefined {
  let tree;
  try {
    tree = parseJvmSource(source, language);
  } catch {
    return undefined;
  }

  const literals: string[] = [];
  const visit = (node: SyntaxNode): void => {
    if (isDeclaredVariableNode(node, language)) {
      const typeNode = findDeclaredTypeNode(node, language);
      if (typeNode !== undefined) {
        literals.push(typeNode.text);
      }
    }
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(tree.rootNode);
  return literals;
}

/**
 * Resolves raw declared type literals (possibly generic or dotted) into FQCN
 * candidates. Fully-qualified tokens (containing `.`) are kept verbatim;
 * simple names are resolved through the file import context.
 */
export function resolveDeclaredTypeCandidates(
  literals: readonly string[],
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): string[] {
  const candidates: string[] = [];
  for (const literal of literals) {
    const tokens = literal.match(IDENTIFIER_PATTERN) ?? [];
    for (const token of tokens) {
      if (token.includes(".")) {
        candidates.push(token);
        continue;
      }
      try {
        candidates.push(
          language === "java"
            ? resolveJavaFqcn(token, importContext)
            : resolveKotlinFqcn(token, importContext),
        );
      } catch {
        // Unresolvable simple name — not a supplement client candidate.
      }
    }
  }
  return candidates;
}

function isDeclaredVariableNode(
  node: SyntaxNode,
  language: "java" | "kotlin",
): boolean {
  if (language === "java") {
    return node.type === "field_declaration" || node.type === "local_variable_declaration";
  }
  return node.type === "property_declaration" || node.type === "local_variable_declaration";
}

function findDeclaredTypeNode(
  node: SyntaxNode,
  language: "java" | "kotlin",
): SyntaxNode | undefined {
  if (language === "java") {
    return node.childForFieldName("type") ?? undefined;
  }

  // Kotlin: the type lives on the `variable_declaration` inside a
  // `property_declaration`, or directly on a `local_variable_declaration`.
  const stack: SyntaxNode[] = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) {
      continue;
    }
    const typeNode = current.childForFieldName("type");
    if (typeNode !== null && typeNode !== undefined) {
      return typeNode;
    }
    stack.push(...current.children);
  }
  return undefined;
}