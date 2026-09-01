import { getAnnotationAttribute, getAnnotationPathValues } from "../java-annotation-utils.js";
import type { JavaAnnotation } from "../java-ast-model.js";
import { ALL_HTTP_METHODS, type HttpMethod } from "./rest-framework-profile.js";
import { formatEndpoint, joinPaths } from "./rest-path-normalizer.js";
import type { RestAnnotationRegistry } from "./rest-annotation-registry.js";

const REQUEST_METHOD_PREFIX = "RequestMethod.";

function parseHttpMethodValue(value: string): HttpMethod | undefined {
  const normalized = value.trim().replace(/^\./, "");
  const methodName = normalized.includes(".")
    ? (normalized.split(".").at(-1) ?? normalized)
    : normalized;
  return ALL_HTTP_METHODS.find((method) => method === methodName.toUpperCase());
}

function parseHttpMethods(annotation: JavaAnnotation): HttpMethod[] {
  const methodAttr = getAnnotationAttribute(annotation, "method");
  if (methodAttr === undefined) {
    return [...ALL_HTTP_METHODS];
  }

  const values = Array.isArray(methodAttr) ? methodAttr : [methodAttr];
  const methods = values
    .map((value) => parseHttpMethodValue(value.replace(REQUEST_METHOD_PREFIX, "")))
    .filter((value): value is HttpMethod => value !== undefined);

  return methods.length > 0 ? methods : [...ALL_HTTP_METHODS];
}

function collectClassBasePaths(
  annotations: readonly JavaAnnotation[],
  registry: RestAnnotationRegistry,
): string[] {
  let paths = [""];

  for (const annotation of annotations) {
    const rules = registry.lookupRulesByRole(annotation, "class-base-path");
    if (rules.length === 0) {
      continue;
    }

    const nextPaths = new Set<string>();
    for (const existing of paths) {
      for (const pathValue of getAnnotationPathValues(annotation)) {
        nextPaths.add(joinPaths(existing, pathValue));
      }
    }
    paths = [...nextPaths];
  }

  return paths;
}

function collectMethodPathSegments(annotation: JavaAnnotation): string[] {
  return getAnnotationPathValues(annotation);
}

export function buildEndpointsForMethod(
  classPaths: readonly string[],
  annotations: readonly JavaAnnotation[],
  registry: RestAnnotationRegistry,
): string[] {
  const endpoints = new Set<string>();

  const httpVerbs = annotations.flatMap((annotation) =>
    registry.lookupRulesByRole(annotation, "http-verb").flatMap((rule) =>
      rule.httpMethod ? [rule.httpMethod] : [],
    ),
  );

  const mappingAnnotations = annotations.filter(
    (annotation) => registry.lookupRulesByRole(annotation, "method-mapping").length > 0,
  );

  if (mappingAnnotations.length === 0 && httpVerbs.length === 0) {
    return [];
  }

  if (httpVerbs.length > 0) {
    const methodPaths = mappingAnnotations.flatMap((annotation) =>
      collectMethodPathSegments(annotation),
    );
    const normalizedMethodPaths = methodPaths.length > 0 ? methodPaths : [""];

    for (const classPath of classPaths) {
      for (const methodPath of normalizedMethodPaths) {
        const fullPath = joinPaths(classPath, methodPath);
        for (const verb of httpVerbs) {
          endpoints.add(formatEndpoint(verb, fullPath));
        }
      }
    }

    return [...endpoints].sort();
  }

  for (const annotation of mappingAnnotations) {
    const rules = registry.lookupRulesByRole(annotation, "method-mapping");
    const methods =
      rules.some((rule) => rule.httpMethod) && annotation.name !== "RequestMapping"
        ? rules.flatMap((rule) => (rule.httpMethod ? [rule.httpMethod] : []))
        : parseHttpMethods(annotation);

    const methodPaths = collectMethodPathSegments(annotation);
    for (const classPath of classPaths) {
      for (const methodPath of methodPaths) {
        const fullPath = joinPaths(classPath, methodPath);
        for (const method of methods) {
          endpoints.add(formatEndpoint(method, fullPath));
        }
      }
    }
  }

  return [...endpoints].sort();
}

export function buildClassBasePaths(
  annotations: readonly JavaAnnotation[],
  registry: RestAnnotationRegistry,
): string[] {
  return collectClassBasePaths(annotations, registry);
}

export function methodHasMapping(
  annotations: readonly JavaAnnotation[],
  registry: RestAnnotationRegistry,
): boolean {
  return annotations.some((annotation) => {
    const rules = registry.lookupRules(annotation);
    return rules.some(
      (rule) => rule.role === "method-mapping" || rule.role === "http-verb",
    );
  });
}
