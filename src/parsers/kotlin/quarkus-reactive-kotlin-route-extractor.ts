import type { JavaAnnotation } from "../java/java-ast-model.js";
import type { KotlinMethodDeclaration } from "./kotlin-ast-model.js";
import { formatEndpoint } from "../java/rest/rest-path-normalizer.js";
import { quarkusReactiveRouteProfile } from "../java/rest/profiles/quarkus-reactive-route-profile.js";

export interface QuarkusReactiveKotlinRouteExtraction {
  readonly endpoints: readonly string[];
}

function hasRouteAnnotation(annotations: readonly JavaAnnotation[]): boolean {
  const names = new Set<string>(quarkusReactiveRouteProfile.routeAnnotationNames);
  return annotations.some(
    (annotation) => names.has(annotation.name) || names.has(annotation.qualifiedName),
  );
}

function parseHttpMethods(attributes: Readonly<Record<string, string | readonly string[]>>): string[] {
  const methods = attributes.methods ?? attributes.value;
  if (!methods) {
    return [quarkusReactiveRouteProfile.defaultHttpMethod];
  }

  if (Array.isArray(methods)) {
    return methods
      .map((method) => method.split(".").at(-1)?.toUpperCase() ?? quarkusReactiveRouteProfile.defaultHttpMethod)
      .filter((method) => method.length > 0);
  }

  if (typeof methods === "string") {
    if (methods.includes("=")) {
      return [quarkusReactiveRouteProfile.defaultHttpMethod];
    }
    return [methods.split(".").at(-1)?.toUpperCase() ?? quarkusReactiveRouteProfile.defaultHttpMethod];
  }

  return [quarkusReactiveRouteProfile.defaultHttpMethod];
}

function resolveRoutePath(annotation: JavaAnnotation): string | undefined {
  const path = annotation.attributes.path;
  if (typeof path === "string" && path.length > 0) {
    return path;
  }

  const regex = annotation.attributes.regex;
  if (typeof regex === "string" && regex.length > 0) {
    return regex;
  }

  return undefined;
}

export function extractQuarkusReactiveKotlinRoutes(
  methods: readonly KotlinMethodDeclaration[],
): QuarkusReactiveKotlinRouteExtraction {
  const endpoints = new Set<string>();

  for (const method of methods) {
    const routeAnnotation = method.annotations.find((annotation) => hasRouteAnnotation([annotation]));
    if (!routeAnnotation) {
      continue;
    }

    const path = resolveRoutePath(routeAnnotation);
    if (!path) {
      continue;
    }

    for (const httpMethod of parseHttpMethods(routeAnnotation.attributes)) {
      endpoints.add(formatEndpoint(httpMethod, path));
    }
  }

  return {
    endpoints: [...endpoints].sort(),
  };
}

export function typeHasRouteMethods(methods: readonly KotlinMethodDeclaration[]): boolean {
  return methods.some((method) => hasRouteAnnotation(method.annotations));
}
