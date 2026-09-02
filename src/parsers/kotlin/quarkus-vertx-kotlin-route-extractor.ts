import type { SyntaxNode } from "tree-sitter";
import type { KotlinParameter } from "./kotlin-ast-model.js";
import { collectCallExpressions, extractStringLiteral } from "./kotlin-functional-cst-utils.js";
import { formatEndpoint } from "../java/rest/rest-path-normalizer.js";
import { quarkusVertxRouterProfile } from "../java/rest/profiles/quarkus-vertx-router-profile.js";

export interface QuarkusVertxKotlinRouteExtraction {
  readonly endpoints: readonly string[];
}

const ROUTER_METHOD_TO_HTTP = new Map<string, string>([
  ["get", "GET"],
  ["post", "POST"],
  ["put", "PUT"],
  ["patch", "PATCH"],
  ["delete", "DELETE"],
  ["head", "HEAD"],
  ["options", "OPTIONS"],
  ["route", "GET"],
]);

export function extractQuarkusVertxKotlinRoutes(
  body: SyntaxNode | undefined,
): QuarkusVertxKotlinRouteExtraction {
  const endpoints = new Set<string>();

  collectCallExpressions(body, (methodName, args) => {
    const httpMethod = ROUTER_METHOD_TO_HTTP.get(methodName.toLowerCase());
    if (!httpMethod || args.length === 0) {
      return;
    }

    const pathSegment = extractStringLiteral(args[0]);
    if (pathSegment === undefined) {
      return;
    }

    endpoints.add(formatEndpoint(httpMethod, pathSegment));
  });

  return {
    endpoints: [...endpoints].sort(),
  };
}

export function methodHasRouterParameter(
  parameters: readonly KotlinParameter[],
  imports: ReadonlyMap<string, string>,
): boolean {
  for (const parameter of parameters) {
    if (!parameter.type) {
      continue;
    }

    const simpleName = parameter.type.simpleName;
    if (
      quarkusVertxRouterProfile.routerTypeNames.some(
        (typeName) => typeName === simpleName || typeName.endsWith(`.${simpleName}`),
      )
    ) {
      return true;
    }

    const imported = imports.get(simpleName);
    if (imported && (quarkusVertxRouterProfile.routerTypeNames as readonly string[]).includes(imported)) {
      return true;
    }

    if (parameter.annotations.some((annotation) => annotation.name === "Observes")) {
      return true;
    }
  }

  return false;
}
