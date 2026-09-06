import type { SyntaxNode } from "tree-sitter";
import type { KotlinMethodDeclaration } from "./kotlin-ast-model.js";
import {
  collectCallExpressions,
  extractStringLiteral,
} from "./kotlin-functional-cst-utils.js";
import { formatEndpoint } from "../java/rest/rest-path-normalizer.js";

const URI_METHOD_NAMES = new Set(["uri", "url", "fromHttpUrl", "fromUriString"]);
const HTTP_VERB_NAMES = new Set(["get", "post", "put", "delete", "patch", "head", "options"]);

function parseHttpMethodFromName(methodName: string): string | undefined {
  const upper = methodName.toUpperCase();
  if (HTTP_VERB_NAMES.has(methodName.toLowerCase())) {
    return upper;
  }
  return undefined;
}

export function extractKotlinHttpEndpointsFromBody(
  body: SyntaxNode | undefined,
  clientFramework: string,
): string[] {
  if (!body) {
    return [];
  }

  const endpoints = new Set<string>();
  let pendingHttpMethod: string | undefined;

  collectCallExpressions(body, (methodName, args) => {
    if (methodName === "method" && args.length >= 2) {
      const methodLiteral = extractStringLiteral(args[0]);
      if (methodLiteral) {
        pendingHttpMethod = methodLiteral.toUpperCase();
      }
      const pathLiteral = extractStringLiteral(args[1]);
      if (pendingHttpMethod && pathLiteral) {
        endpoints.add(formatEndpoint(pendingHttpMethod as "GET", pathLiteral));
      }
      return;
    }

    if (URI_METHOD_NAMES.has(methodName) && args.length > 0) {
      const pathLiteral = extractStringLiteral(args[0]);
      if (pathLiteral) {
        const httpMethod = pendingHttpMethod ?? "GET";
        endpoints.add(formatEndpoint(httpMethod as "GET", pathLiteral));
      }
      pendingHttpMethod = undefined;
      return;
    }

    const verbMethod = parseHttpMethodFromName(methodName);
    if (verbMethod && args.length > 0) {
      const pathLiteral = extractStringLiteral(args[0]);
      if (pathLiteral) {
        endpoints.add(formatEndpoint(verbMethod as "GET", pathLiteral));
        return;
      }
      if (clientFramework === "ktor-client") {
        pendingHttpMethod = verbMethod;
      }
    }
  });

  return [...endpoints].sort();
}

export function collectKotlinMethodHttpEndpoints(
  method: KotlinMethodDeclaration,
  clientFramework: string,
): string[] {
  return extractKotlinHttpEndpointsFromBody(method.body, clientFramework);
}
