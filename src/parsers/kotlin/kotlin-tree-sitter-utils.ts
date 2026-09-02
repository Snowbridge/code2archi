import type { SyntaxNode } from "tree-sitter";

export function nodeChildren(node: SyntaxNode): SyntaxNode[] {
  const children: SyntaxNode[] = [];
  for (let index = 0; index < node.namedChildCount; index += 1) {
    const child = node.namedChild(index);
    if (child) {
      children.push(child);
    }
  }
  return children;
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

export function findDirectChild(node: SyntaxNode, type: string): SyntaxNode | undefined {
  for (let index = 0; index < node.namedChildCount; index += 1) {
    const child = node.namedChild(index);
    if (child?.type === type) {
      return child;
    }
  }

  return undefined;
}

export function findDirectChildren(node: SyntaxNode, type: string): SyntaxNode[] {
  const matches: SyntaxNode[] = [];

  for (let index = 0; index < node.namedChildCount; index += 1) {
    const child = node.namedChild(index);
    if (child?.type === type) {
      matches.push(child);
    }
  }

  return matches;
}

export function findFirstChild(node: SyntaxNode, type: string): SyntaxNode | undefined {
  return findChildren(node, type)[0];
}

export function childByField(node: SyntaxNode, fieldName: string): SyntaxNode | undefined {
  return node.childForFieldName(fieldName) ?? undefined;
}

export function nodeText(node: SyntaxNode | null | undefined): string {
  return node?.text ?? "";
}
