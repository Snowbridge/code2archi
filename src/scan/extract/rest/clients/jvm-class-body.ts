import type { SyntaxNode } from "tree-sitter";
import { parseJvmSource } from "../../../../parsers/jvm/jvm-parser.js";

export interface JvmMethodBody {
  readonly name: string;
  readonly text: string;
}

export function extractClassBodyText(
  source: string,
  language: "java" | "kotlin",
  simpleName: string,
): string | undefined {
  const tree = parseJvmSource(source, language);
  const classNode = findClassNode(tree.rootNode, language, simpleName);
  if (classNode === undefined) {
    return undefined;
  }
  const body = getClassBodyNode(classNode, language);
  return body?.text ?? classNode.text;
}

export function extractClassMethodBodies(
  source: string,
  language: "java" | "kotlin",
  simpleName: string,
): readonly JvmMethodBody[] {
  const tree = parseJvmSource(source, language);
  const classNode = findClassNode(tree.rootNode, language, simpleName);
  if (classNode === undefined) {
    return [];
  }
  const body = getClassBodyNode(classNode, language);
  if (body === null || body === undefined) {
    return [];
  }

  const methods: JvmMethodBody[] = [];
  for (const child of body.children) {
    if (language === "java" && child.type === "method_declaration") {
      const nameNode = child.childForFieldName("name");
      if (nameNode) {
        methods.push({ name: nameNode.text, text: child.text });
      }
      continue;
    }
    if (language === "kotlin" && child.type === "function_declaration") {
      const nameNode = child.childForFieldName("name") ?? findTypeIdentifier(child);
      if (nameNode !== undefined) {
        methods.push({ name: nameNode.text, text: child.text });
      }
    }
  }
  return methods;
}

function findClassNode(
  node: SyntaxNode,
  language: "java" | "kotlin",
  simpleName: string,
): SyntaxNode | undefined {
  const classTypes =
    language === "java"
      ? ["class_declaration", "interface_declaration"]
      : ["class_declaration"];

  if (classTypes.includes(node.type)) {
    const nameNode = resolveTypeNameNode(node, language);
    if (nameNode?.text === simpleName) {
      return node;
    }
  }

  for (const child of node.children) {
    const found = findClassNode(child, language, simpleName);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

function getClassBodyNode(
  classNode: SyntaxNode,
  language: "java" | "kotlin",
): SyntaxNode | null | undefined {
  if (language === "kotlin") {
    return (
      classNode.childForFieldName("body") ??
      classNode.children.find((child) => child.type === "class_body") ??
      null
    );
  }
  return classNode.childForFieldName("body");
}

function resolveTypeNameNode(
  node: SyntaxNode,
  language: "java" | "kotlin",
): SyntaxNode | undefined {
  const nameField = node.childForFieldName("name");
  if (nameField !== null && nameField !== undefined) {
    return nameField;
  }
  if (language === "kotlin") {
    return findTypeIdentifier(node);
  }
  return undefined;
}

function findTypeIdentifier(node: SyntaxNode): SyntaxNode | undefined {
  for (const child of node.children) {
    if (child.type === "type_identifier" || child.type === "simple_identifier") {
      return child;
    }
  }
  return undefined;
}
