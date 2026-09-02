import type { GenericCstNode } from "../java-cst-utils.js";
import { collectPrimaryInvocations, extractStringLiteral } from "./functional-cst-utils.js";
import { formatEndpoint } from "./rest-path-normalizer.js";
import { quarkusVertxRouterProfile } from "./profiles/quarkus-vertx-router-profile.js";

export interface QuarkusVertxRouteExtraction {
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

export function extractQuarkusVertxRoutes(body: GenericCstNode | undefined): QuarkusVertxRouteExtraction {
  const endpoints = new Set<string>();

  collectPrimaryInvocations(body, (methodName, args) => {
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
  parameters: readonly { readonly type?: { readonly simpleName: string } }[],
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
  }

  return false;
}
