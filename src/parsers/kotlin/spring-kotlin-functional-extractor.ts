import type { SyntaxNode } from "tree-sitter";
import type { JavaTypeRef } from "../java/java-ast-model.js";
import { formatEndpoint, joinPaths } from "../java/rest/rest-path-normalizer.js";
import { springRouterFunctionProfile } from "../java/rest/profiles/spring-router-function-profile.js";
import { resolveKotlinTypeFqcn } from "./kotlin-type-resolver.js";
import {
  extractCallableReferenceName,
  extractStringLiteral,
  findLambdaBlockArgument,
  findTrailingLambda,
  getCallArguments,
  getCallName,
} from "./kotlin-functional-cst-utils.js";
import { nodeChildren } from "./kotlin-tree-sitter-utils.js";

export interface SpringKotlinRouteExtraction {
  readonly endpoints: readonly string[];
  readonly handlerMethodNames: readonly string[];
}

const HTTP_METHOD_SET = new Set<string>(springRouterFunctionProfile.httpMethodNames);
const PATH_PREFIX_METHODS = new Set<string>(springRouterFunctionProfile.pathPrefixMethodNames);
const ROUTER_ENTRYPOINTS = new Set<string>([
  ...springRouterFunctionProfile.kotlinRouterEntrypointNames,
  ...springRouterFunctionProfile.routeBuilderMethodNames,
]);

export function isRouterFunctionType(
  typeRef: JavaTypeRef | undefined,
  packageName: string | undefined,
  imports: ReadonlyMap<string, string>,
): boolean {
  if (!typeRef) {
    return false;
  }

  if (typeRef.simpleName === "RouterFunction") {
    return true;
  }

  const fqcn = resolveKotlinTypeFqcn(typeRef, packageName, imports);
  return springRouterFunctionProfile.routerFunctionTypeNames.some((typeName) => fqcn === typeName);
}

export function isCoRouterFunctionType(
  typeRef: JavaTypeRef | undefined,
  packageName: string | undefined,
  imports: ReadonlyMap<string, string>,
): boolean {
  if (!typeRef) {
    return false;
  }

  if (typeRef.simpleName === "CoRouterFunction") {
    return true;
  }

  const fqcn = resolveKotlinTypeFqcn(typeRef, packageName, imports);
  return springRouterFunctionProfile.coRouterFunctionTypeNames.some((typeName) => fqcn === typeName);
}

function handleSpringKotlinCall(
  callNode: SyntaxNode,
  pathPrefix: string,
  endpoints: Set<string>,
  handlerMethodNames: Set<string>,
  visitChild: (node: SyntaxNode, prefix: string) => void,
): void {
  const methodName = getCallName(callNode);
  if (!methodName) {
    return;
  }

  const upperMethod = methodName.toUpperCase();
  const args = getCallArguments(callNode);
  const lambda = findLambdaBlockArgument(args) ?? findTrailingLambda(callNode);

  if (ROUTER_ENTRYPOINTS.has(methodName)) {
    if (lambda) {
      visitChild(lambda, pathPrefix);
    }
    return;
  }

  if (PATH_PREFIX_METHODS.has(methodName)) {
    const prefixSegment = extractStringLiteral(args[0]);
    if (prefixSegment !== undefined && lambda) {
      visitChild(lambda, joinPaths(pathPrefix, prefixSegment));
    }
    return;
  }

  if (!HTTP_METHOD_SET.has(upperMethod)) {
    return;
  }

  const pathSegment = extractStringLiteral(args[0]);
  if (pathSegment === undefined) {
    return;
  }

  endpoints.add(formatEndpoint(upperMethod, joinPaths(pathPrefix, pathSegment)));
  const handlerName = extractCallableReferenceName(args[1]);
  if (handlerName) {
    handlerMethodNames.add(handlerName);
  }
}

function walkSpringKotlinNodes(
  node: SyntaxNode | undefined,
  pathPrefix: string,
  endpoints: Set<string>,
  handlerMethodNames: Set<string>,
): void {
  if (!node) {
    return;
  }

  if (node.type === "call_expression") {
    handleSpringKotlinCall(node, pathPrefix, endpoints, handlerMethodNames, (child, prefix) => {
      walkSpringKotlinNodes(child, prefix, endpoints, handlerMethodNames);
    });
    return;
  }

  for (const child of nodeChildren(node)) {
    walkSpringKotlinNodes(child, pathPrefix, endpoints, handlerMethodNames);
  }
}

function processSpringKotlinBody(
  node: SyntaxNode | undefined,
  pathPrefix: string,
  endpoints: Set<string>,
  handlerMethodNames: Set<string>,
): void {
  walkSpringKotlinNodes(node, pathPrefix, endpoints, handlerMethodNames);
}

export function extractSpringKotlinRoutes(body: SyntaxNode | undefined): SpringKotlinRouteExtraction {
  const endpoints = new Set<string>();
  const handlerMethodNames = new Set<string>();
  processSpringKotlinBody(body, "", endpoints, handlerMethodNames);

  return {
    endpoints: [...endpoints].sort(),
    handlerMethodNames: [...handlerMethodNames].sort(),
  };
}
