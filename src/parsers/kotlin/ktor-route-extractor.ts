import type { SyntaxNode } from "tree-sitter";
import type { JavaTypeRef } from "../java/java-ast-model.js";
import { formatEndpoint, joinPaths } from "../java/rest/rest-path-normalizer.js";
import { resolveKotlinTypeFqcn } from "./kotlin-type-resolver.js";
import {
  bodyContainsCallNamed,
  extractStringLiteral,
  findLambdaBlockArgument,
  findTrailingLambda,
  getCallArguments,
  getCallName,
} from "./kotlin-functional-cst-utils.js";
import { nodeChildren } from "./kotlin-tree-sitter-utils.js";
import { ktorRoutingProfile } from "./profiles/ktor-routing-profile.js";

export interface KtorRouteExtraction {
  readonly endpoints: readonly string[];
}

const HTTP_METHOD_SET = new Set<string>(ktorRoutingProfile.httpMethodNames);
const PATH_PREFIX_METHODS = new Set<string>(ktorRoutingProfile.pathPrefixMethodNames);

function handleKtorCall(
  callNode: SyntaxNode,
  pathPrefix: string,
  endpoints: Set<string>,
  visitChild: (node: SyntaxNode, prefix: string) => void,
): void {
  const methodName = getCallName(callNode)?.toLowerCase();
  if (!methodName) {
    return;
  }

  const args = getCallArguments(callNode);
  const lambda = findLambdaBlockArgument(args) ?? findTrailingLambda(callNode);

  if (methodName === "routing") {
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

  if (!HTTP_METHOD_SET.has(methodName)) {
    return;
  }

  const pathSegment = extractStringLiteral(args[0]);
  if (pathSegment === undefined) {
    return;
  }

  endpoints.add(formatEndpoint(methodName.toUpperCase(), joinPaths(pathPrefix, pathSegment)));
}

function walkKtorNodes(
  node: SyntaxNode | undefined,
  pathPrefix: string,
  endpoints: Set<string>,
): void {
  if (!node) {
    return;
  }

  if (node.type === "call_expression") {
    handleKtorCall(node, pathPrefix, endpoints, (child, prefix) => {
      walkKtorNodes(child, prefix, endpoints);
    });
    return;
  }

  for (const child of nodeChildren(node)) {
    walkKtorNodes(child, pathPrefix, endpoints);
  }
}

function processKtorBody(
  node: SyntaxNode | undefined,
  pathPrefix: string,
  endpoints: Set<string>,
): void {
  walkKtorNodes(node, pathPrefix, endpoints);
}

export function extractKtorRoutes(body: SyntaxNode | undefined): KtorRouteExtraction {
  const endpoints = new Set<string>();
  processKtorBody(body, "", endpoints);

  return {
    endpoints: [...endpoints].sort(),
  };
}

export function isKtorRoutingHost(body: SyntaxNode | undefined): boolean {
  return bodyContainsCallNamed(body, ktorRoutingProfile.routingFunctionNames);
}

export function isKtorRouteExtension(
  receiverType: JavaTypeRef | undefined,
  packageName: string | undefined,
  imports: ReadonlyMap<string, string>,
): boolean {
  if (!receiverType) {
    return false;
  }

  if (receiverType.simpleName === "Route") {
    return true;
  }

  const fqcn = resolveKotlinTypeFqcn(receiverType, packageName, imports);
  return ktorRoutingProfile.routeReceiverTypeNames.some((typeName) => fqcn === typeName);
}
