import type { JvmAnnotation, JvmMethodModel, JvmTypeModel } from "../../../parsers/jvm/types.js";
import {
  annotationMatches,
  annotationStringAttribute,
  resolveTypeName,
} from "../../../parsers/jvm/extract-jvm-file.js";
import type { JvmImportContext } from "../../../parsers/type-resolution/types.js";
import { formatHttpEndpoint } from "./endpoint-format.js";

const RETROFIT_HTTP_METHODS = new Map<string, string>([
  ["GET", "GET"],
  ["POST", "POST"],
  ["PUT", "PUT"],
  ["DELETE", "DELETE"],
  ["PATCH", "PATCH"],
  ["HTTP", "HTTP"],
]);

const DECLARATIVE_EXCLUSIONS = ["RegisterRestClient", "FeignClient"] as const;

export function isRetrofitClient(
  type: JvmTypeModel,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): boolean {
  for (const marker of DECLARATIVE_EXCLUSIONS) {
    if (type.annotations.some((annotation) => annotationMatches(annotation, marker))) {
      return false;
    }
  }
  return type.methods.some((method) =>
    method.annotations.some((annotation) =>
      isRetrofitHttpMethodAnnotation(annotation, importContext, language),
    ),
  );
}

export function extractRetrofitEndpoints(
  type: JvmTypeModel,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): string[] {
  const endpoints: string[] = [];
  for (const method of type.methods) {
    endpoints.push(...extractRetrofitMethodEndpoints(method, importContext, language));
  }
  return endpoints;
}

function extractRetrofitMethodEndpoints(
  method: JvmMethodModel,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): string[] {
  const endpoints: string[] = [];
  for (const annotation of method.annotations) {
    if (!isRetrofitHttpMethodAnnotation(annotation, importContext, language)) {
      continue;
    }
    const simpleName = annotationSimpleName(annotation.name);
    if (simpleName === "HTTP") {
      const methodAttr = annotation.attributes.method;
      const httpMethod =
        typeof methodAttr === "string" ? methodAttr.replace(/^["']|["']$/g, "") : "GET";
      const path = annotationStringAttribute(annotation, "path", "value") ?? "";
      endpoints.push(formatHttpEndpoint(httpMethod, path));
      continue;
    }
    const httpMethod = RETROFIT_HTTP_METHODS.get(simpleName) ?? "GET";
    const path = annotationStringAttribute(annotation, "value", "path") ?? "";
    endpoints.push(formatHttpEndpoint(httpMethod, path));
  }
  return endpoints;
}

function isRetrofitHttpMethodAnnotation(
  annotation: JvmAnnotation,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): boolean {
  const simpleName = annotationSimpleName(annotation.name);
  if (!RETROFIT_HTTP_METHODS.has(simpleName)) {
    return false;
  }
  if (annotation.name.includes("retrofit2.http")) {
    return true;
  }
  const resolved = resolveTypeName(annotation.name, importContext, language);
  return resolved.startsWith("retrofit2.http.");
}

function annotationSimpleName(name: string): string {
  return name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : name;
}
