import {
  asGenericCstNode,
  childNodes,
  firstChild,
  getTokenImage,
  walkDescendants,
  type GenericCstNode,
} from "../java-cst-utils.js";

export function extractStringLiteral(expression: GenericCstNode | undefined): string | undefined {
  if (!expression) {
    return undefined;
  }

  const literal = firstChild(expression, "literal");
  if (literal) {
    const stringLiteral = firstChild(literal, "StringLiteral");
    if (stringLiteral) {
      const image = getTokenImage(stringLiteral);
      if (image && image.length >= 2) {
        return image.slice(1, -1);
      }
    }
  }

  for (const childList of Object.values(expression.children ?? {})) {
    for (const child of childList) {
      const genericChild = asGenericCstNode(child);
      if (!genericChild) {
        continue;
      }
      const value = extractStringLiteral(genericChild);
      if (value !== undefined) {
        return value;
      }
    }
  }

  return undefined;
}

export function getSuffixName(primarySuffix: GenericCstNode): string | undefined {
  if (typeof primarySuffix.image === "string" && primarySuffix.image.length > 0) {
    return primarySuffix.image.replace(/^\./, "");
  }

  const identifier = primarySuffix.children?.Identifier?.[0];
  const identifierImage = getTokenImage(identifier);
  if (identifierImage) {
    return identifierImage;
  }

  return getTokenImage(primarySuffix)?.replace(/^\./, "");
}

export function getTrailingPrimaryPrefixName(primary: GenericCstNode): string | undefined {
  const prefix = firstChild(primary, "primaryPrefix");
  if (!prefix) {
    return undefined;
  }

  let lastName: string | undefined;
  for (const part of walkDescendants(prefix, "fqnOrRefTypePartCommon")) {
    const image = getTokenImage(part);
    if (image) {
      lastName = image;
    }
  }

  return lastName;
}

export function getInvocationArgumentExpressions(
  invocationSuffix: GenericCstNode | undefined,
): GenericCstNode[] {
  const argumentList = firstChild(invocationSuffix, "argumentList");
  if (!argumentList) {
    return [];
  }

  return childNodes(argumentList, "expression");
}

export function extractMethodReferenceName(expression: GenericCstNode | undefined): string | undefined {
  if (!expression) {
    return undefined;
  }

  const methodReferenceSuffix = firstChild(expression, "methodReferenceSuffix");
  if (methodReferenceSuffix) {
    const identifierTokens = methodReferenceSuffix.children?.Identifier;
    if (identifierTokens && identifierTokens.length > 0) {
      return getTokenImage(identifierTokens.at(-1));
    }
  }

  const methodReference = firstChild(expression, "methodReference");
  if (methodReference) {
    const identifierTokens = methodReference.children?.Identifier;
    if (identifierTokens && identifierTokens.length > 0) {
      return getTokenImage(identifierTokens.at(-1));
    }
  }

  for (const childList of Object.values(expression.children ?? {})) {
    for (const child of childList) {
      const genericChild = asGenericCstNode(child);
      if (!genericChild) {
        continue;
      }
      const name = extractMethodReferenceName(genericChild);
      if (name) {
        return name;
      }
    }
  }

  return undefined;
}

export function extractIdentifierName(expression: GenericCstNode | undefined): string | undefined {
  if (!expression) {
    return undefined;
  }

  const primary = firstChild(expression, "primary");
  if (primary?.children?.this) {
    return "this";
  }

  const identifier = primary?.children?.Identifier?.[0];
  return getTokenImage(identifier);
}

export function extractReferenceName(expression: GenericCstNode | undefined): string | undefined {
  if (!expression) {
    return undefined;
  }

  const identifierName = extractIdentifierName(expression);
  if (identifierName) {
    return identifierName;
  }

  let lastName: string | undefined;
  for (const part of walkDescendants(expression, "fqnOrRefTypePartCommon")) {
    const image = getTokenImage(part);
    if (image) {
      lastName = image;
    }
  }

  if (lastName) {
    return lastName;
  }

  for (const childList of Object.values(expression.children ?? {})) {
    for (const child of childList) {
      const genericChild = asGenericCstNode(child);
      if (!genericChild) {
        continue;
      }

      const name = extractReferenceName(genericChild);
      if (name) {
        return name;
      }
    }
  }

  return undefined;
}

export function collectPrimaryInvocations(
  node: GenericCstNode | undefined,
  visitor: (methodName: string, args: GenericCstNode[]) => void,
): void {
  if (!node) {
    return;
  }

  for (const primary of walkDescendants(node, "primary")) {
    const trailingName = getTrailingPrimaryPrefixName(primary);
    const suffixes = childNodes(primary, "primarySuffix");
    let handledByPrefix = false;

    if (trailingName && suffixes.length > 0) {
      const invocationSuffix = firstChild(suffixes[0], "methodInvocationSuffix");
      const prefixArgs = getInvocationArgumentExpressions(invocationSuffix);
      if (prefixArgs.length > 0) {
        visitor(trailingName, prefixArgs);
        handledByPrefix = true;
      }
    }

    let pendingMethodName: string | undefined;

    for (const primarySuffix of suffixes) {
      const suffixName = getSuffixName(primarySuffix);
      const invocationSuffix = firstChild(primarySuffix, "methodInvocationSuffix");
      const args = getInvocationArgumentExpressions(invocationSuffix);

      if (handledByPrefix && !suffixName && args.length > 0) {
        continue;
      }

      if (suffixName && args.length === 0 && !invocationSuffix) {
        pendingMethodName = suffixName;
        continue;
      }

      if (suffixName) {
        visitor(suffixName, args);
        pendingMethodName = undefined;
        continue;
      }

      if (args.length > 0 && pendingMethodName) {
        visitor(pendingMethodName, args);
        pendingMethodName = undefined;
      }
    }
  }
}
