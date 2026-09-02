import type { JavaTypeRef } from "../java-ast-model.js";
import {
  childNodes,
  firstChild,
  walkDescendants,
  type GenericCstNode,
} from "../java-cst-utils.js";
import { resolveTypeFqcn } from "../java-type-resolver.js";
import {
  extractMethodReferenceName,
  extractStringLiteral,
  getInvocationArgumentExpressions,
  getSuffixName,
} from "./functional-cst-utils.js";
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

export function extractFunctionalRoutes(body: GenericCstNode | undefined): FunctionalRouteExtraction {
  const endpoints = new Set<string>();
  const handlerMethodNames = new Set<string>();

  collectFromSubtree(body, "", endpoints, handlerMethodNames);

  return {
    endpoints: [...endpoints].sort(),
    handlerMethodNames: [...handlerMethodNames].sort(),
  };
}

export function isRouterFunctionType(
  typeRef: JavaTypeRef | { readonly simpleName: string } | undefined,
  packageName: string | undefined,
  imports: ReadonlyMap<string, string>,
): boolean {
  if (!typeRef) {
    return false;
  }

  if (typeRef.simpleName === "RouterFunction") {
    return true;
  }

  if (!("raw" in typeRef)) {
    return false;
  }

  const fqcn = resolveTypeFqcn(typeRef, packageName, imports);
  return springRouterFunctionProfile.routerFunctionTypeNames.some((typeName) => fqcn === typeName);
}
