import type { JvmAnnotation, JvmMethodModel, JvmTypeModel } from "../../../parsers/jvm/types.js";
import {
  annotationMatches,
  annotationStringAttribute,
} from "../../../parsers/jvm/extract-jvm-file.js";
import { formatHttpEndpoint, joinPathPrefixes } from "./endpoint-format.js";

const MICRONAUT_CONTROLLER = "Controller";
const MICRONAUT_HTTP_METHODS = new Map<string, string>([
  ["Get", "GET"],
  ["Post", "POST"],
  ["Put", "PUT"],
  ["Delete", "DELETE"],
  ["Patch", "PATCH"],
  ["Head", "HEAD"],
  ["Options", "OPTIONS"],
]);

export function isMicronautController(type: JvmTypeModel): boolean {
  return type.annotations.some(
    (annotation) =>
      annotationMatches(annotation, MICRONAUT_CONTROLLER) &&
      !annotation.name.includes("org.springframework"),
  );
}

export function isMicronautRouteBuilder(type: JvmTypeModel): boolean {
  return (
    type.implementedInterfaces.some((name) => name.includes("RouteBuilder")) ||
    type.fqcn.includes("RouteBuilder")
  );
}

export function extractMicronautClassPathPrefix(type: JvmTypeModel): string {
  for (const annotation of type.annotations) {
    if (!annotationMatches(annotation, MICRONAUT_CONTROLLER)) {
      continue;
    }
    return annotationStringAttribute(annotation, "value") ?? "";
  }
  return "";
}

export function extractMicronautEndpoints(
  type: JvmTypeModel,
  classPathPrefix: string,
): string[] {
  const endpoints: string[] = [];
  for (const method of type.methods) {
    endpoints.push(...extractMicronautMethodEndpoints(method, classPathPrefix));
  }
  return endpoints;
}

function extractMicronautMethodEndpoints(
  method: JvmMethodModel,
  classPathPrefix: string,
): string[] {
  const endpoints: string[] = [];
  for (const annotation of method.annotations) {
    const httpMethod = resolveMicronautHttpMethod(annotation);
    if (httpMethod === undefined) {
      continue;
    }
    const path = annotationStringAttribute(annotation, "value", "uri") ?? "";
    endpoints.push(formatHttpEndpoint(httpMethod, joinPathPrefixes(classPathPrefix, path)));
  }
  return endpoints;
}

function resolveMicronautHttpMethod(annotation: JvmAnnotation): string | undefined {
  const simpleName = annotation.name.includes(".")
    ? annotation.name.slice(annotation.name.lastIndexOf(".") + 1)
    : annotation.name;
  return MICRONAUT_HTTP_METHODS.get(simpleName);
}
