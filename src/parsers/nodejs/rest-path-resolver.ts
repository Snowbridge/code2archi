import type { SyntaxNode } from "tree-sitter";
import { normalizePathSegment } from "../java/rest/rest-path-normalizer.js";
import {
  childByField,
  nodeChildren,
  nodeText,
  unwrapExpression,
  walkNodes,
} from "./nodejs-tree-sitter-utils.js";

const HTTP_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "ALL",
]);

export function resolveStringLiteral(node: SyntaxNode, source: string): string | undefined {
  const unwrapped = unwrapExpression(node);

  if (unwrapped.type === "string") {
    const text = nodeText(unwrapped, source);
    if (
      (text.startsWith("'") && text.endsWith("'")) ||
      (text.startsWith('"') && text.endsWith('"'))
    ) {
      return text.slice(1, -1);
    }

    return text;
  }

  if (unwrapped.type === "template_string") {
    return resolveTemplateString(unwrapped, source);
  }

  if (unwrapped.type === "binary_expression") {
    const operator = childByField(unwrapped, "operator");
    if (operator && nodeText(operator, source) === "+") {
      const left = childByField(unwrapped, "left");
      const right = childByField(unwrapped, "right");
      const leftValue = left ? resolveStringLiteral(left, source) : undefined;
      const rightValue = right ? resolveStringLiteral(right, source) : undefined;
      if (leftValue !== undefined && rightValue !== undefined) {
        return `${leftValue}${rightValue}`;
      }
    }
  }

  if (unwrapped.type === "identifier") {
    return undefined;
  }

  return undefined;
}

function resolveTemplateString(node: SyntaxNode, source: string): string | undefined {
  const parts: string[] = [];

  for (const child of nodeChildren(node)) {
    if (child.type === "string_fragment") {
      parts.push(nodeText(child, source));
      continue;
    }

    if (child.type === "template_substitution") {
      parts.push(":param");
    }
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join("");
}

export function resolvePathArgument(node: SyntaxNode | undefined, source: string): string | undefined {
  if (!node) {
    return undefined;
  }

  const resolved = resolveStringLiteral(node, source);
  if (resolved === undefined) {
    return undefined;
  }

  return normalizePathSegment(resolved);
}

export function extractHttpMethodFromPropertyName(propertyName: string): string | undefined {
  const lower = propertyName.toLowerCase();
  if (lower === "all" || lower === "use") {
    return "ALL";
  }

  const upper = propertyName.toUpperCase();
  return HTTP_METHODS.has(upper) ? upper : undefined;
}

export function extractMethodFromRouteOptions(
  objectNode: SyntaxNode,
  source: string,
): { readonly method?: string; readonly path?: string } {
  let method: string | undefined;
  let pathValue: string | undefined;

  walkNodes(objectNode, (current) => {
    if (current.type !== "pair") {
      return;
    }

    const keyNode = childByField(current, "key");
    const valueNode = childByField(current, "value");
    if (!keyNode || !valueNode) {
      return;
    }

    const key = nodeText(keyNode, source).replace(/['"]/g, "");
    if (key === "method") {
      const resolved = resolveStringLiteral(valueNode, source);
      if (resolved) {
        method = resolved.toUpperCase();
      }
    }

    if (key === "url" || key === "path") {
      pathValue = resolvePathArgument(valueNode, source);
    }
  });

  return { method, path: pathValue };
}

export function collectFileLevelStringConstants(
  root: SyntaxNode,
  source: string,
): Map<string, string> {
  const constants = new Map<string, string>();

  walkNodes(root, (node) => {
    if (node.type !== "lexical_declaration" && node.type !== "variable_declaration") {
      return;
    }

    for (const declarator of nodeChildren(node)) {
      if (declarator.type !== "variable_declarator") {
        continue;
      }

      const nameNode = childByField(declarator, "name");
      const valueNode = childByField(declarator, "value");
      if (!nameNode || !valueNode || nameNode.type !== "identifier") {
        continue;
      }

      const value = resolveStringLiteral(valueNode, source);
      if (value !== undefined) {
        constants.set(nodeText(nameNode, source), value);
      }
    }
  });

  return constants;
}

export function resolvePathWithConstants(
  node: SyntaxNode,
  source: string,
  constants: ReadonlyMap<string, string>,
): string | undefined {
  const unwrapped = unwrapExpression(node);

  if (unwrapped.type === "identifier") {
    const name = nodeText(unwrapped, source);
    const constantValue = constants.get(name);
    if (constantValue !== undefined) {
      return normalizePathSegment(constantValue);
    }
  }

  return resolvePathArgument(node, source);
}
