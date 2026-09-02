import type { SyntaxNode } from "tree-sitter";
import type { JavaAnnotation } from "../java/java-ast-model.js";
import {
  childByField,
  findChildren,
  findFirstChild,
  nodeChildren,
  nodeText,
} from "./kotlin-tree-sitter-utils.js";

function collectIdentifiers(node: SyntaxNode): string[] {
  const identifiers: string[] = [];
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
      identifiers.push(current.text);
    }

    for (const child of nodeChildren(current)) {
      stack.push(child);
    }
  }

  return identifiers;
}

function parseAnnotationValue(node: SyntaxNode | undefined): string | readonly string[] | undefined {
  if (!node) {
    return undefined;
  }

  if (node.type === "string_literal") {
    const text = nodeText(node);
    if (text.length >= 2) {
      return text.slice(1, -1);
    }
    return text;
  }

  if (node.type === "collection_literal") {
    const values: string[] = [];
    for (const child of nodeChildren(node)) {
      if (child.type === "string_literal") {
        const text = nodeText(child);
        if (text.length >= 2) {
          values.push(text.slice(1, -1));
        }
        continue;
      }

      if (child.type === "," || child.type === "[" || child.type === "]") {
        continue;
      }

      const text = nodeText(child).trim();
      if (text.length > 0) {
        values.push(text);
      }
    }
    return values;
  }

  const stringLiteral = findFirstChild(node, "string_literal");
  if (stringLiteral) {
    const text = nodeText(stringLiteral);
    return text.length >= 2 ? text.slice(1, -1) : text;
  }

  return undefined;
}

function parseValueArguments(annotationNode: SyntaxNode): Readonly<Record<string, string | readonly string[]>> {
  const attributes: Record<string, string | readonly string[]> = {};
  const valueArguments = findFirstChild(annotationNode, "value_arguments");
  if (!valueArguments) {
    return attributes;
  }

  for (const argument of nodeChildren(valueArguments)) {
    if (argument.type !== "value_argument") {
      continue;
    }

    const children = nodeChildren(argument).filter(
      (child) => child.type !== "," && child.type !== "(" && child.type !== ")",
    );
    const nameNode = children.find((child) => child.type === "simple_identifier");
    const valueNode =
      childByField(argument, "value") ??
      children.find((child) => child !== nameNode) ??
      children.at(-1);
    const parsedValue = parseAnnotationValue(valueNode);
    if (parsedValue === undefined) {
      continue;
    }

    const key = nameNode ? nodeText(nameNode) : childByField(argument, "name") ? nodeText(childByField(argument, "name")!) : "value";
    attributes[key] = parsedValue;
  }

  return attributes;
}

function parseAnnotationNode(annotationNode: SyntaxNode): JavaAnnotation | undefined {
  const userType =
    childByField(annotationNode, "type") ??
    findFirstChild(annotationNode, "user_type") ??
    findFirstChild(annotationNode, "type_reference");
  if (!userType) {
    return undefined;
  }

  const parts = collectIdentifiers(userType);
  if (parts.length === 0) {
    return undefined;
  }

  const qualifiedName = parts.join(".");
  const name = parts.at(-1) ?? qualifiedName;

  return {
    name,
    qualifiedName,
    attributes: parseValueArguments(annotationNode),
  };
}

export function extractAnnotations(node: SyntaxNode): JavaAnnotation[] {
  const annotations: JavaAnnotation[] = [];

  for (const modifier of nodeChildren(node)) {
    if (modifier.type !== "modifiers" && modifier.type !== "parameter_modifiers") {
      continue;
    }

    for (const child of nodeChildren(modifier)) {
      if (child.type === "annotation" || child.type === "single_annotation") {
        const parsed = parseAnnotationNode(child);
        if (parsed) {
          annotations.push(parsed);
        }
      }
    }
  }

  return annotations;
}

export function hasSuspendModifier(node: SyntaxNode): boolean {
  for (const modifier of findChildren(node, "modifiers")) {
    for (const child of nodeChildren(modifier)) {
      if (child.type === "suspend_modifier" || child.type === "function_modifier") {
        if (child.text === "suspend") {
          return true;
        }
      }
    }
  }

  return findChildren(node, "suspend_modifier").length > 0;
}
