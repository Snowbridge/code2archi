import type { SyntaxNode } from "tree-sitter";
import type { JavaTypeRef } from "../java/java-ast-model.js";
import {
  childByField,
  findFirstChild,
  nodeChildren,
  nodeText,
} from "./kotlin-tree-sitter-utils.js";

function collectTypeNameParts(node: SyntaxNode): string[] {
  const parts: string[] = [];
  const stack = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (
      current.type === "simple_identifier" ||
      current.type === "identifier" ||
      current.type === "type_identifier"
    ) {
      parts.push(current.text);
      continue;
    }

    if (current.type === "user_type") {
      for (const child of nodeChildren(current)) {
        stack.push(child);
      }
      continue;
    }

    for (const child of nodeChildren(current)) {
      stack.push(child);
    }
  }

  return parts;
}

function parseTypeArguments(node: SyntaxNode | undefined): JavaTypeRef[] {
  if (!node) {
    return [];
  }

  const typeArguments: JavaTypeRef[] = [];
  const typeArgumentList =
    findFirstChild(node, "type_arguments") ?? findFirstChild(node, "type_projection");
  if (!typeArgumentList) {
    for (const child of nodeChildren(node)) {
      if (child.type === "type_projection" || child.type === "user_type" || child.type === "nullable_type") {
        const parsed = parseTypeRef(child);
        if (parsed) {
          typeArguments.push(parsed);
        }
      }
    }
    return typeArguments;
  }

  for (const child of nodeChildren(typeArgumentList)) {
    const parsed = parseTypeRef(child);
    if (parsed) {
      typeArguments.push(parsed);
    }
  }

  return typeArguments;
}

export function parseTypeRef(node: SyntaxNode | undefined): JavaTypeRef | undefined {
  if (!node) {
    return undefined;
  }

  if (node.type === "nullable_type") {
    const inner = nodeChildren(node).find((child) => child.type !== "question_mark");
    return parseTypeRef(inner);
  }

  if (node.type === "function_type") {
    return {
      raw: node.text,
      simpleName: "Function",
      typeArguments: [],
    };
  }

  const userType =
    node.type === "user_type" || node.type === "type_identifier" || node.type === "type_reference"
      ? node
      : findFirstChild(node, "user_type") ?? findFirstChild(node, "type_reference");

  if (!userType) {
    return undefined;
  }

  const parts = collectTypeNameParts(userType);
  if (parts.length === 0) {
    return undefined;
  }

  const simpleName = parts.at(-1) ?? parts.join(".");
  const typeArgumentsNode =
    findFirstChild(userType, "type_arguments") ?? findFirstChild(node, "type_arguments");

  return {
    raw: node.text,
    simpleName,
    typeArguments: parseTypeArguments(typeArgumentsNode),
  };
}

export function resolveKotlinTypeFqcn(
  typeRef: JavaTypeRef,
  packageName: string | undefined,
  imports: ReadonlyMap<string, string>,
): string {
  if (typeRef.simpleName.includes(".")) {
    return typeRef.simpleName;
  }

  const imported = imports.get(typeRef.simpleName);
  if (imported) {
    return imported;
  }

  if (packageName) {
    return `${packageName}.${typeRef.simpleName}`;
  }

  return typeRef.simpleName;
}
