import {
  asGenericCstNode,
  childNodes,
  firstChild,
  getTokenImage,
  walkDescendants,
  type GenericCstNode,
} from "../java-cst-utils.js";
import { formatEndpoint, joinPaths } from "./rest-path-normalizer.js";
import {
  springRouterFunctionProfile,
  type SpringRouterHttpMethod,
} from "./profiles/spring-router-function-profile.js";

export interface FunctionalRouteExtraction {
  readonly endpoints: readonly string[];
  readonly handlerMethodNames: readonly string[];
}

const HTTP_METHOD_SET = new Set<string>(springRouterFunctionProfile.httpMethodNames);
const PATH_PREFIX_METHODS = new Set<string>(springRouterFunctionProfile.pathPrefixMethodNames);

function extractStringLiteral(expression: GenericCstNode | undefined): string | undefined {
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

function extractMethodReferenceName(expression: GenericCstNode | undefined): string | undefined {
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

function getSuffixName(primarySuffix: GenericCstNode): string | undefined {
  if (typeof primarySuffix.image === "string" && primarySuffix.image.length > 0) {
    return primarySuffix.image;
  }

  return getTokenImage(primarySuffix);
}

function getInvocationArgumentExpressions(
  invocationSuffix: GenericCstNode | undefined,
): GenericCstNode[] {
  const argumentList = firstChild(invocationSuffix, "argumentList");
  if (!argumentList) {
    return [];
  }

  return childNodes(argumentList, "expression");
}

function processPrimary(
  primary: GenericCstNode,
  pathPrefix: string,
  endpoints: Set<string>,
  handlerMethodNames: Set<string>,
): void {
  const suffixes = childNodes(primary, "primarySuffix");
  let pendingHttpMethod: string | undefined;

  for (const primarySuffix of suffixes) {
    const suffixName = getSuffixName(primarySuffix);
    const invocationSuffix = firstChild(primarySuffix, "methodInvocationSuffix");
    const args = getInvocationArgumentExpressions(invocationSuffix);

    if (suffixName && PATH_PREFIX_METHODS.has(suffixName)) {
      pendingHttpMethod = undefined;
      const prefixSegment = extractStringLiteral(args[0]);
      if (prefixSegment !== undefined && args[1]) {
        const nestedPrimary = firstChild(args[1], "primary");
        if (nestedPrimary) {
          processPrimary(nestedPrimary, joinPaths(pathPrefix, prefixSegment), endpoints, handlerMethodNames);
        } else {
          collectFromSubtree(args[1], joinPaths(pathPrefix, prefixSegment), endpoints, handlerMethodNames);
        }
      }
      continue;
    }

    if (suffixName && HTTP_METHOD_SET.has(suffixName) && args.length === 0) {
      pendingHttpMethod = suffixName;
      continue;
    }

    const httpMethod = pendingHttpMethod;
    if (httpMethod && HTTP_METHOD_SET.has(httpMethod) && args.length > 0) {
      pendingHttpMethod = undefined;
      const pathSegment = extractStringLiteral(args[0]);
      if (pathSegment !== undefined) {
        endpoints.add(
          formatEndpoint(httpMethod as SpringRouterHttpMethod, joinPaths(pathPrefix, pathSegment)),
        );
        const handlerName = extractMethodReferenceName(args[1]);
        if (handlerName) {
          handlerMethodNames.add(handlerName);
        }
      }
      continue;
    }

    if (suffixName && HTTP_METHOD_SET.has(suffixName) && args.length > 0) {
      pendingHttpMethod = undefined;
      const pathSegment = extractStringLiteral(args[0]);
      if (pathSegment !== undefined) {
        endpoints.add(
          formatEndpoint(suffixName as SpringRouterHttpMethod, joinPaths(pathPrefix, pathSegment)),
        );
        const handlerName = extractMethodReferenceName(args[1]);
        if (handlerName) {
          handlerMethodNames.add(handlerName);
        }
      }
    }
  }
}

function collectFromSubtree(
  node: GenericCstNode | undefined,
  pathPrefix: string,
  endpoints: Set<string>,
  handlerMethodNames: Set<string>,
): void {
  if (!node) {
    return;
  }

  for (const primary of walkDescendants(node, "primary")) {
    processPrimary(primary, pathPrefix, endpoints, handlerMethodNames);
  }
}

export function extractFunctionalRoutes(methodBody: GenericCstNode | undefined): FunctionalRouteExtraction {
  const endpoints = new Set<string>();
  const handlerMethodNames = new Set<string>();

  collectFromSubtree(methodBody, "", endpoints, handlerMethodNames);

  return {
    endpoints: [...endpoints].sort(),
    handlerMethodNames: [...handlerMethodNames].sort(),
  };
}
