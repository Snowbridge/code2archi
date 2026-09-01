import type { JavaAnnotation } from "./java-ast-model.js";
import {
  asGenericCstNode,
  childNodes,
  firstChild,
  getNodeText,
  getTokenImage,
  isGenericCstNode,
  type GenericCstNode,
} from "./java-cst-utils.js";

function collectTypeName(source: string, node: GenericCstNode | undefined): string {
  if (!node) {
    return "";
  }

  if (node.name === "typeName" || node.name === "packageOrTypeName") {
    const parts: string[] = [];
    collectIdentifiers(source, node, parts);
    return parts.join(".");
  }

  if (!node.children) {
    return "";
  }

  for (const childList of Object.values(node.children)) {
    for (const child of childList) {
      const genericChild = asGenericCstNode(child);
      if (!genericChild) {
        continue;
      }
      const text = collectTypeName(source, genericChild);
      if (text) {
        return text;
      }
    }
  }

  return "";
}

function collectIdentifiers(source: string, node: GenericCstNode, parts: string[]): void {
  if (!node.children) {
    return;
  }

  const directIdentifierTokens = node.children.Identifier;
  if (directIdentifierTokens) {
    for (const token of directIdentifierTokens) {
      const image = getTokenImage(token);
      if (image) {
        parts.push(image);
      }
    }
    return;
  }

  for (const childList of Object.values(node.children)) {
    for (const child of childList) {
      const genericChild = asGenericCstNode(child);
      if (!genericChild) {
        continue;
      }
      if (genericChild.name === "Identifier") {
        const image = getTokenImage(genericChild);
        if (image) {
          parts.push(image);
        }
      } else {
        collectIdentifiers(source, genericChild, parts);
      }
    }
  }
}

function parseAnnotationAttributes(body: string): Record<string, string | string[]> {
  const trimmed = body.trim();
  if (!trimmed) {
    return {};
  }

  if (trimmed.startsWith("{")) {
    return parseNamedAttributes(trimmed.slice(1, -1));
  }

  return { value: parseAttributeValue(trimmed) };
}

function parseNamedAttributes(body: string): Record<string, string | string[]> {
  const attributes: Record<string, string | string[]> = {};
  const pairs = splitTopLevel(body, ",");
  for (const pair of pairs) {
    const eqIndex = findTopLevelEquals(pair);
    if (eqIndex < 0) {
      continue;
    }
    const key = pair.slice(0, eqIndex).trim();
    const value = pair.slice(eqIndex + 1).trim();
    attributes[key] = parseAttributeValue(value);
  }
  return attributes;
}

function parseAttributeValue(value: string): string | string[] {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return splitTopLevel(trimmed.slice(1, -1), ",").map((part) =>
      part.trim().replace(/^\./, ""),
    );
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function splitTopLevel(input: string, separator: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depthBrace = 0;
  let depthParen = 0;
  let inString: "'" | '"' | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] ?? "";
    const prev = input[index - 1];

    if (inString) {
      current += char;
      if (char === inString && prev !== "\\") {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      current += char;
      continue;
    }

    if (char === "{") {
      depthBrace += 1;
      current += char;
      continue;
    }
    if (char === "}") {
      depthBrace -= 1;
      current += char;
      continue;
    }
    if (char === "(") {
      depthParen += 1;
      current += char;
      continue;
    }
    if (char === ")") {
      depthParen -= 1;
      current += char;
      continue;
    }

    if (char === separator && depthBrace === 0 && depthParen === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function findTopLevelEquals(input: string): number {
  let depthBrace = 0;
  let depthParen = 0;
  let inString: "'" | '"' | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] ?? "";
    const prev = input[index - 1];

    if (inString) {
      if (char === inString && prev !== "\\") {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }

    if (char === "{") {
      depthBrace += 1;
      continue;
    }
    if (char === "}") {
      depthBrace -= 1;
      continue;
    }
    if (char === "(") {
      depthParen += 1;
      continue;
    }
    if (char === ")") {
      depthParen -= 1;
      continue;
    }

    if (char === "=" && depthBrace === 0 && depthParen === 0) {
      return index;
    }
  }

  return -1;
}

export function parseAnnotation(source: string, node: GenericCstNode): JavaAnnotation | undefined {
  const qualifiedName = collectTypeName(source, node);
  if (!qualifiedName) {
    return undefined;
  }

  const simpleName = qualifiedName.includes(".")
    ? (qualifiedName.split(".").at(-1) ?? qualifiedName)
    : qualifiedName;

  const annotationText = getNodeText(source, node);
  const bodyMatch = annotationText.match(/^@[\w.]+\s*(\([\s\S]*\)|\{[\s\S]*\})?$/);
  let attributes: Record<string, string | string[]> = {};

  if (bodyMatch?.[1]) {
    const body = bodyMatch[1].trim();
    if (body.startsWith("(") && body.endsWith(")")) {
      attributes = parseAnnotationAttributes(body.slice(1, -1));
    } else if (body.startsWith("{") && body.endsWith("}")) {
      attributes = parseNamedAttributes(body.slice(1, -1));
    }
  }

  return {
    name: simpleName,
    qualifiedName,
    attributes,
  };
}

export function extractAnnotations(source: string, modifierNode: GenericCstNode | undefined): JavaAnnotation[] {
  if (!modifierNode?.children) {
    return [];
  }

  const annotations: JavaAnnotation[] = [];
  for (const childList of Object.values(modifierNode.children)) {
    for (const child of childList) {
      const genericChild = asGenericCstNode(child);
      if (!genericChild || genericChild.name !== "annotation") {
        continue;
      }
      const parsed = parseAnnotation(source, genericChild);
      if (parsed) {
        annotations.push(parsed);
      }
    }
  }

  return annotations;
}

export function collectModifierAnnotations(
  source: string,
  modifierNodes: readonly unknown[] | undefined,
): JavaAnnotation[] {
  const annotations: JavaAnnotation[] = [];
  if (!modifierNodes) {
    return annotations;
  }

  for (const modifierNode of modifierNodes) {
    const genericModifier = asGenericCstNode(modifierNode);
    if (genericModifier) {
      annotations.push(...extractAnnotations(source, genericModifier));
    }
  }
  return annotations;
}

export function getAnnotationAttribute(
  annotation: JavaAnnotation,
  ...keys: readonly string[]
): string | readonly string[] | undefined {
  for (const key of keys) {
    const value = annotation.attributes[key];
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

export function getAnnotationPathValues(annotation: JavaAnnotation): string[] {
  const raw = getAnnotationAttribute(annotation, "value", "path", "uri");
  if (raw === undefined) {
    return [""];
  }
  if (Array.isArray(raw)) {
    return raw.length > 0 ? [...raw] : [""];
  }
  return [typeof raw === "string" ? raw : String(raw)];
}

export function hasAnnotationChild(node: unknown): node is GenericCstNode {
  return isGenericCstNode(node);
}

export { childNodes, firstChild };
