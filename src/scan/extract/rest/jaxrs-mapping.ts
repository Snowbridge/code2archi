import type { JvmAnnotation, JvmMethodModel, JvmTypeModel } from "../../../parsers/jvm/types.js";
import {
  annotationMatches,
  annotationStringAttribute,
} from "../../../parsers/jvm/extract-jvm-file.js";
import { formatHttpEndpoint, joinPathPrefixes } from "./endpoint-format.js";

const JAXRS_PATH = "Path";
const JAXRS_METHODS = new Map<string, string>([
  ["GET", "GET"],
  ["POST", "POST"],
  ["PUT", "PUT"],
  ["DELETE", "DELETE"],
  ["PATCH", "PATCH"],
  ["HEAD", "HEAD"],
  ["OPTIONS", "OPTIONS"],
]);

export function isJaxRsResource(type: JvmTypeModel): boolean {
  if (type.annotations.some((annotation) => annotationMatches(annotation, "RegisterRestClient"))) {
    return false;
  }
  const classHasPath = type.annotations.some((annotation) => annotationMatches(annotation, JAXRS_PATH));
  const methodHasJaxRs = type.methods.some(
    (method) =>
      method.annotations.some((annotation) => annotationMatches(annotation, JAXRS_PATH)) ||
      method.annotations.some((annotation) => isJaxRsHttpMethodAnnotation(annotation)),
  );
  return classHasPath || methodHasJaxRs;
}

export function extractJaxRsClassPathPrefix(type: JvmTypeModel): string {
  for (const annotation of type.annotations) {
    if (!annotationMatches(annotation, JAXRS_PATH)) {
      continue;
    }
    return annotationStringAttribute(annotation, "value") ?? "";
  }
  return "";
}

export function extractJaxRsEndpoints(
  type: JvmTypeModel,
  classPathPrefix: string,
): string[] {
  const endpoints: string[] = [];
  for (const method of type.methods) {
    endpoints.push(...extractJaxRsMethodEndpoints(method, classPathPrefix));
  }
  return endpoints;
}

function extractJaxRsMethodEndpoints(
  method: JvmMethodModel,
  classPathPrefix: string,
): string[] {
  const endpoints: string[] = [];
  let methodPath = "";
  for (const annotation of method.annotations) {
    if (annotationMatches(annotation, JAXRS_PATH)) {
      methodPath = annotationStringAttribute(annotation, "value") ?? "";
    }
  }
  const fullPath = joinPathPrefixes(classPathPrefix, methodPath);
  for (const annotation of method.annotations) {
    const httpMethod = resolveJaxRsHttpMethod(annotation);
    if (httpMethod !== undefined) {
      endpoints.push(formatHttpEndpoint(httpMethod, fullPath));
    }
  }
  return endpoints;
}

function resolveJaxRsHttpMethod(annotation: JvmAnnotation): string | undefined {
  const simpleName = annotation.name.includes(".")
    ? annotation.name.slice(annotation.name.lastIndexOf(".") + 1)
    : annotation.name;
  return JAXRS_METHODS.get(simpleName);
}

function isJaxRsHttpMethodAnnotation(annotation: JvmAnnotation): boolean {
  return resolveJaxRsHttpMethod(annotation) !== undefined;
}
