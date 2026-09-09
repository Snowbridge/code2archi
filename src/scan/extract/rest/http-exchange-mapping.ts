import type { JvmAnnotation, JvmMethodModel, JvmTypeModel } from "../../../parsers/jvm/types.js";
import {
  annotationMatches,
  annotationStringAttribute,
  resolveTypeName,
} from "../../../parsers/jvm/extract-jvm-file.js";
import type { JvmImportContext } from "../../../parsers/type-resolution/types.js";
import { formatHttpEndpoint, joinPathPrefixes } from "./endpoint-format.js";

const SPRING_HTTP_EXCHANGE = "HttpExchange";
const SPRING_HTTP_EXCHANGE_METHODS = new Map<string, string>([
  ["GetExchange", "GET"],
  ["PostExchange", "POST"],
  ["PutExchange", "PUT"],
  ["DeleteExchange", "DELETE"],
  ["PatchExchange", "PATCH"],
]);

export function isSpringHttpExchangeClient(
  type: JvmTypeModel,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): boolean {
  if (
    type.annotations.some((annotation) =>
      isSpringHttpExchangeTypeAnnotation(annotation, importContext, language),
    )
  ) {
    return true;
  }
  return type.methods.some((method) =>
    method.annotations.some((annotation) =>
      isSpringHttpExchangeMethodAnnotation(annotation, importContext, language),
    ),
  );
}

export function extractSpringHttpExchangeClassPathPrefix(
  type: JvmTypeModel,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): string {
  for (const annotation of type.annotations) {
    if (!isSpringHttpExchangeTypeAnnotation(annotation, importContext, language)) {
      continue;
    }
    return annotationStringAttribute(annotation, "url", "path", "value") ?? "";
  }
  return "";
}

export function extractSpringHttpExchangeEndpoints(
  type: JvmTypeModel,
  classPathPrefix: string,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): string[] {
  const endpoints: string[] = [];
  for (const method of type.methods) {
    endpoints.push(
      ...extractSpringHttpExchangeMethodEndpoints(
        method,
        classPathPrefix,
        importContext,
        language,
      ),
    );
  }
  return endpoints;
}

function extractSpringHttpExchangeMethodEndpoints(
  method: JvmMethodModel,
  classPathPrefix: string,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): string[] {
  const endpoints: string[] = [];
  for (const annotation of method.annotations) {
    if (!isSpringHttpExchangeMethodAnnotation(annotation, importContext, language)) {
      continue;
    }
    const mappingName = annotationSimpleName(annotation.name);
    const httpMethod = SPRING_HTTP_EXCHANGE_METHODS.get(mappingName) ?? "GET";
    const path = annotationStringAttribute(annotation, "url", "path", "value") ?? "";
    endpoints.push(formatHttpEndpoint(httpMethod, joinPathPrefixes(classPathPrefix, path)));
  }
  return endpoints;
}

function isSpringHttpExchangeTypeAnnotation(
  annotation: JvmAnnotation,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): boolean {
  if (!annotationMatches(annotation, SPRING_HTTP_EXCHANGE)) {
    return false;
  }
  return resolvesToSpringWebServiceAnnotation(annotation, importContext, language);
}

function isSpringHttpExchangeMethodAnnotation(
  annotation: JvmAnnotation,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): boolean {
  const simpleName = annotationSimpleName(annotation.name);
  if (!SPRING_HTTP_EXCHANGE_METHODS.has(simpleName)) {
    return false;
  }
  return resolvesToSpringWebServiceAnnotation(annotation, importContext, language);
}

function resolvesToSpringWebServiceAnnotation(
  annotation: JvmAnnotation,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): boolean {
  if (annotation.name.includes("org.springframework.web.service.annotation")) {
    return true;
  }
  const resolved = resolveTypeName(annotation.name, importContext, language);
  return resolved.includes("org.springframework.web.service.annotation");
}

function annotationSimpleName(name: string): string {
  return name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : name;
}
