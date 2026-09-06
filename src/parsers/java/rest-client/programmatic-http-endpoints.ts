import type { JavaMethodDeclaration, JavaTypeDeclaration } from "../java-ast-model.js";
import type { GenericCstNode } from "../java-cst-utils.js";
import {
  APACHE_HTTP_CLIENT_FRAMEWORK,
  extractApacheHttpEndpointsForType,
} from "./apache-http-client-extractor.js";
import { extractRestTemplatePathLiteral } from "./uri-components-builder-extractor.js";
import {
  collectPrimaryInvocations,
  extractStringLiteral,
} from "../rest/functional-cst-utils.js";
import { formatEndpoint } from "../rest/rest-path-normalizer.js";

const URI_METHOD_NAMES = new Set(["uri", "fromUriString"]);
const URL_METHOD_NAMES = new Set(["url"]);
const REST_TEMPLATE_CALLS = new Set([
  "getForEntity",
  "getForObject",
  "postForEntity",
  "postForObject",
  "put",
  "delete",
  "exchange",
  "patchForObject",
]);

export function isSpringBeanMethod(method: JavaMethodDeclaration): boolean {
  return method.annotations.some(
    (annotation) =>
      annotation.name === "Bean" ||
      annotation.qualifiedName === "org.springframework.context.annotation.Bean",
  );
}

function parseHttpMethodFromName(methodName: string): string | undefined {
  const upper = methodName.toUpperCase();
  if (upper === "GET" || upper === "POST" || upper === "PUT" || upper === "PATCH" || upper === "DELETE") {
    return upper;
  }
  if (methodName === "getForEntity" || methodName === "getForObject") {
    return "GET";
  }
  if (methodName === "postForEntity" || methodName === "postForObject") {
    return "POST";
  }
  if (methodName === "patchForObject") {
    return "PATCH";
  }
  if (methodName === "delete") {
    return "DELETE";
  }
  if (methodName === "put") {
    return "PUT";
  }
  return undefined;
}

export function extractJavaHttpEndpointsFromBody(
  body: GenericCstNode | undefined,
  clientFramework: string,
  type?: JavaTypeDeclaration,
): string[] {
  if (!body) {
    return [];
  }

  if (clientFramework === APACHE_HTTP_CLIENT_FRAMEWORK && type) {
    return extractApacheHttpEndpointsForType(type);
  }

  const endpoints = new Set<string>();
  let pendingHttpMethod: string | undefined;

  collectPrimaryInvocations(body, (methodName, args) => {
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

    if (URL_METHOD_NAMES.has(methodName) && args.length > 0) {
      const pathLiteral = extractStringLiteral(args[0]);
      if (pathLiteral) {
        const httpMethod = pendingHttpMethod ?? "GET";
        endpoints.add(formatEndpoint(httpMethod as "GET", pathLiteral));
      }
      pendingHttpMethod = undefined;
      return;
    }

    if (REST_TEMPLATE_CALLS.has(methodName) && args.length > 0) {
      const pathLiteral =
        clientFramework === "rest-template"
          ? extractRestTemplatePathLiteral(args[0])
          : extractStringLiteral(args[0]);
      const httpMethod = parseHttpMethodFromName(methodName);
      if (pathLiteral && httpMethod) {
        endpoints.add(formatEndpoint(httpMethod as "GET", pathLiteral));
      }
      return;
    }

    if (methodName === "path" && args.length > 0) {
      const pathLiteral = extractStringLiteral(args[0]);
      if (pathLiteral && pendingHttpMethod) {
        endpoints.add(formatEndpoint(pendingHttpMethod as "GET", pathLiteral));
      }
    }

    if (methodName === "post" || methodName === "get" || methodName === "put" || methodName === "delete") {
      pendingHttpMethod = methodName.toUpperCase();
    }
  });

  return [...endpoints].sort();
}

export function collectJavaClassHttpEndpoints(
  type: JavaTypeDeclaration,
  clientFramework: string,
  options?: { excludeSpringBeanMethods?: boolean },
): { endpoints: string[]; handlerMethods: JavaMethodDeclaration[] } {
  const endpoints = new Set<string>();
  const handlerMethods: JavaMethodDeclaration[] = [];
  const excludeSpringBeanMethods = options?.excludeSpringBeanMethods ?? false;

  if (clientFramework === APACHE_HTTP_CLIENT_FRAMEWORK) {
    for (const endpoint of extractApacheHttpEndpointsForType(type)) {
      endpoints.add(endpoint);
    }

    for (const method of type.methods) {
      if (method.body && (!excludeSpringBeanMethods || !isSpringBeanMethod(method))) {
        handlerMethods.push(method);
      }
    }
  } else {
    for (const method of type.methods) {
      if (excludeSpringBeanMethods && isSpringBeanMethod(method)) {
        continue;
      }
      const methodEndpoints = extractJavaHttpEndpointsFromBody(method.body, clientFramework, type);
      if (methodEndpoints.length > 0) {
        handlerMethods.push(method);
        for (const endpoint of methodEndpoints) {
          endpoints.add(endpoint);
        }
      }
    }
  }

  return {
    endpoints: [...endpoints].sort(),
    handlerMethods,
  };
}
