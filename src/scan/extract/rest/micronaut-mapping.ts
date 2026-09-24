import type { JvmAnnotation, JvmMethodModel, JvmTypeModel } from "../../../parsers/jvm/types.js";
import {
  annotationMatches,
  annotationStringAttribute,
  resolveTypeName,
} from "../../../parsers/jvm/extract-jvm-file.js";
import type { JvmImportContext } from "../../../parsers/type-resolution/types.js";
import { formatHttpEndpoint, joinPathPrefixes } from "./endpoint-format.js";

const MICRONAUT_CONTROLLER = "Controller";
const MICRONAUT_CONTROLLER_FQCN = "io.micronaut.http.annotation.Controller";
const MICRONAUT_CLIENT = "Client";
const MICRONAUT_HTTP_METHODS = new Map<string, string>([
  ["Get", "GET"],
  ["Post", "POST"],
  ["Put", "PUT"],
  ["Delete", "DELETE"],
  ["Patch", "PATCH"],
  ["Head", "HEAD"],
  ["Options", "OPTIONS"],
]);

export function isMicronautController(
  type: JvmTypeModel,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): boolean {
  return type.annotations.some((annotation) => {
    if (!annotationMatches(annotation, MICRONAUT_CONTROLLER)) {
      return false;
    }
    if (annotation.name.includes("org.springframework")) {
      return false;
    }
    const resolved = resolveTypeName(annotation.name, importContext, language);
    return (
      resolved === MICRONAUT_CONTROLLER_FQCN ||
      resolved.startsWith("io.micronaut.http.annotation.")
    );
  });
}

export function isMicronautRouteBuilder(type: JvmTypeModel): boolean {
  return (
    type.implementedInterfaces.some((name) => name.includes("RouteBuilder")) ||
    type.fqcn.includes("RouteBuilder")
  );
}

export function isMicronautDeclarativeClient(
  type: JvmTypeModel,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): boolean {
  if (isMicronautController(type, importContext, language)) {
    return false;
  }
  return type.annotations.some((annotation) =>
    isMicronautClientAnnotation(annotation, importContext, language),
  );
}

export function extractMicronautClientPathPrefix(
  type: JvmTypeModel,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): string {
  for (const annotation of type.annotations) {
    if (!isMicronautClientAnnotation(annotation, importContext, language)) {
      continue;
    }
    return annotationStringAttribute(annotation, "value", "id", "path") ?? "";
  }
  return "";
}

export function extractMicronautClientEndpoints(
  type: JvmTypeModel,
  classPathPrefix: string,
): string[] {
  return extractMicronautEndpoints(type, classPathPrefix);
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

function isMicronautClientAnnotation(
  annotation: JvmAnnotation,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): boolean {
  if (!annotationMatches(annotation, MICRONAUT_CLIENT)) {
    return false;
  }
  if (annotation.name.includes("io.micronaut.http.client.annotation")) {
    return true;
  }
  const resolved = resolveTypeName(annotation.name, importContext, language);
  return resolved.includes("micronaut") && resolved.includes("Client");
}
