export interface GenericCstNode {
  readonly name?: string;
  readonly children?: Readonly<Record<string, readonly unknown[]>>;
  readonly image?: string;
  readonly location?: {
    readonly startOffset: number;
    readonly endOffset: number;
  };
}

export function asGenericCstNode(value: unknown): GenericCstNode | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  return value as GenericCstNode;
}

export function isGenericCstNode(value: unknown): value is GenericCstNode {
  return typeof value === "object" && value !== null && "name" in value;
}

export function childNodes(
  node: GenericCstNode | undefined,
  childName: string,
): GenericCstNode[] {
  const children = node?.children?.[childName];
  if (!children) {
    return [];
  }
  return children.map(asGenericCstNode).filter((child): child is GenericCstNode => child !== undefined);
}

export function firstChild(
  node: GenericCstNode | undefined,
  childName: string,
): GenericCstNode | undefined {
  return childNodes(node, childName)[0];
}

export function walkDescendants(
  node: GenericCstNode | undefined,
  childName: string,
): GenericCstNode[] {
  const matches: GenericCstNode[] = [];
  matches.push(...childNodes(node, childName));

  if (!node?.children) {
    return matches;
  }

  for (const childList of Object.values(node.children)) {
    for (const child of childList) {
      const genericChild = asGenericCstNode(child);
      if (genericChild) {
        matches.push(...walkDescendants(genericChild, childName));
      }
    }
  }

  return matches;
}

export function getTokenImage(node: unknown): string | undefined {
  const generic = asGenericCstNode(node);
  if (!generic) {
    if (typeof node === "object" && node !== null && "image" in node) {
      const image = (node as { image?: unknown }).image;
      return typeof image === "string" ? image : undefined;
    }
    return undefined;
  }

  if (typeof generic.image === "string") {
    return generic.image;
  }

  const identifierToken = firstChild(generic, "Identifier");
  if (identifierToken) {
    return getTokenImage(identifierToken);
  }

  const identifierTokens = generic.children?.Identifier;
  if (identifierTokens && identifierTokens.length > 0) {
    return getTokenImage(identifierTokens[0]);
  }

  return undefined;
}

export function getNodeText(source: string, node: GenericCstNode | undefined): string {
  if (!node) {
    return "";
  }

  if (typeof node.image === "string") {
    return node.image;
  }

  if (node.location?.endOffset === undefined) {
    return "";
  }

  return source.slice(node.location.startOffset, node.location.endOffset + 1);
}
