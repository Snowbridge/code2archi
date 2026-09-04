import type { SyntaxNode } from "tree-sitter";

export function nodeChildren(node: SyntaxNode): readonly SyntaxNode[] {
  const children: SyntaxNode[] = [];
  for (let index = 0; index < node.childCount; index += 1) {
    const child = node.child(index);
    if (child) {
      children.push(child);
    }
  }

  return children;
}

export function nodeText(node: SyntaxNode, source: string): string {
  return source.slice(node.startIndex, node.endIndex);
}

export function findChildren(node: SyntaxNode, type: string): SyntaxNode[] {
  const matches: SyntaxNode[] = [];
  const stack = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (current.type === type) {
      matches.push(current);
    }

    for (const child of nodeChildren(current)) {
      stack.push(child);
    }
  }

  return matches;
}

export function findFirstChild(node: SyntaxNode, type: string): SyntaxNode | undefined {
  const stack = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (current.type === type) {
      return current;
    }

    for (const child of nodeChildren(current)) {
      stack.push(child);
    }
  }

  return undefined;
}

export function findDirectChildren(node: SyntaxNode, type: string): SyntaxNode[] {
  return nodeChildren(node).filter((child) => child.type === type);
}

export function childByField(node: SyntaxNode, fieldName: string): SyntaxNode | undefined {
  return node.childForFieldName(fieldName) ?? undefined;
}

export function walkNodes(node: SyntaxNode, visitor: (current: SyntaxNode) => void): void {
  const stack = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    visitor(current);

    for (const child of nodeChildren(current)) {
      stack.push(child);
    }
  }
}

export function unwrapExpression(node: SyntaxNode): SyntaxNode {
  if (
    node.type === "parenthesized_expression" ||
    node.type === "as_expression" ||
    node.type === "type_assertion" ||
    node.type === "await_expression" ||
    node.type === "unary_expression"
  ) {
    const inner = childByField(node, "expression") ?? nodeChildren(node)[0];
    if (inner) {
      return unwrapExpression(inner);
    }
  }

  return node;
}

export function isStringLiteralNode(node: SyntaxNode): boolean {
  return node.type === "string" || node.type === "template_string";
}

export function extractIdentifierName(node: SyntaxNode, source: string): string | undefined {
  if (node.type === "identifier" || node.type === "property_identifier") {
    return nodeText(node, source);
  }

  if (node.type === "member_expression") {
    const property = childByField(node, "property");
    if (property) {
      return extractIdentifierName(property, source);
    }
  }

  return undefined;
}
