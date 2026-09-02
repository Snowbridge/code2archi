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
  getTrailingPrimaryPrefixName,
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
const ROUTE_COMBINE_METHODS = new Set<string>(springRouterFunctionProfile.routeBuilderMethodNames);

function extractStaticHttpRoute(
  argument: GenericCstNode | undefined,
): { readonly httpMethod: string; readonly path: string } | undefined {
  if (!argument) {
    return undefined;
  }

  for (const primary of walkDescendants(argument, "primary")) {
    const trailingName = getTrailingPrimaryPrefixName(primary);
    const suffixes = childNodes(primary, "primarySuffix");

    if (trailingName && HTTP_METHOD_SET.has(trailingName) && suffixes.length > 0) {
      const args = getInvocationArgumentExpressions(
        firstChild(suffixes[0], "methodInvocationSuffix"),
      );
      const pathSegment = extractStringLiteral(args[0]);
      if (pathSegment !== undefined) {
        return { httpMethod: trailingName, path: pathSegment };
      }
    }

    for (const primarySuffix of suffixes) {
      const suffixName = getSuffixName(primarySuffix);
      if (!suffixName || !HTTP_METHOD_SET.has(suffixName)) {
        continue;
      }

      const invocationSuffix = firstChild(primarySuffix, "methodInvocationSuffix");
      const args = getInvocationArgumentExpressions(invocationSuffix);
      if (args.length === 0) {
        continue;
      }

      const pathSegment = extractStringLiteral(args[0]);
      if (pathSegment !== undefined) {
        return { httpMethod: suffixName, path: pathSegment };
      }
    }
  }

  return undefined;
}

function processRouteCombineArgs(
  args: readonly GenericCstNode[],
  pathPrefix: string,
  endpoints: Set<string>,
  handlerMethodNames: Set<string>,
): void {
  if (args.length < 2) {
    return;
  }

  const route = extractStaticHttpRoute(args[0]);
  if (!route) {
    return;
  }

  endpoints.add(
    formatEndpoint(route.httpMethod as SpringRouterHttpMethod, joinPaths(pathPrefix, route.path)),
  );
  const handlerName = extractMethodReferenceName(args[1]);
  if (handlerName) {
    handlerMethodNames.add(handlerName);
  }
}

function processPrimary(
  primary: GenericCstNode,
  pathPrefix: string,
  endpoints: Set<string>,
  handlerMethodNames: Set<string>,
): void {
  const trailingName = getTrailingPrimaryPrefixName(primary);
  const suffixes = childNodes(primary, "primarySuffix");
  let pendingHttpMethod: string | undefined;
  let pendingRouteCombine: string | undefined;
  let handledRoutePrefix = false;

  if (trailingName && ROUTE_COMBINE_METHODS.has(trailingName) && suffixes.length > 0) {
    const firstArgs = getInvocationArgumentExpressions(
      firstChild(suffixes[0], "methodInvocationSuffix"),
    );
    if (firstArgs.length >= 2) {
      processRouteCombineArgs(firstArgs, pathPrefix, endpoints, handlerMethodNames);
      handledRoutePrefix = true;
    }
  }

  for (let index = 0; index < suffixes.length; index++) {
    const primarySuffix = suffixes[index]!;
    if (handledRoutePrefix && index === 0) {
      continue;
    }

    const suffixName = getSuffixName(primarySuffix);
    const invocationSuffix = firstChild(primarySuffix, "methodInvocationSuffix");
    const args = getInvocationArgumentExpressions(invocationSuffix);

    if (suffixName && ROUTE_COMBINE_METHODS.has(suffixName) && args.length >= 2) {
      processRouteCombineArgs(args, pathPrefix, endpoints, handlerMethodNames);
      pendingRouteCombine = undefined;
      continue;
    }

    if (suffixName && ROUTE_COMBINE_METHODS.has(suffixName) && args.length === 0 && !invocationSuffix) {
      pendingRouteCombine = suffixName;
      continue;
    }

    if (!suffixName && args.length >= 2 && pendingRouteCombine) {
      processRouteCombineArgs(args, pathPrefix, endpoints, handlerMethodNames);
      pendingRouteCombine = undefined;
      continue;
    }

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
