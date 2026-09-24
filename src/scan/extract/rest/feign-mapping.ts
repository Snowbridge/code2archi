import type { JvmTypeModel } from "../../../parsers/jvm/types.js";
import {
  annotationMatches,
  annotationStringAttribute,
  resolveTypeName,
} from "../../../parsers/jvm/extract-jvm-file.js";
import type { JvmImportContext } from "../../../parsers/type-resolution/types.js";
import { joinPathPrefixes } from "./endpoint-format.js";
import {
  extractSpringClassPathPrefix,
  extractSpringEndpoints,
} from "./spring-mapping.js";

const FEIGN_CLIENT = "FeignClient";
const FEIGN_CLIENT_FQCN = "org.springframework.cloud.openfeign.FeignClient";

export function isFeignClient(
  type: JvmTypeModel,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): boolean {
  return type.annotations.some((annotation) =>
    isFeignClientAnnotation(annotation, importContext, language),
  );
}

export function extractFeignClientPathPrefix(type: JvmTypeModel): string {
  for (const annotation of type.annotations) {
    if (!annotationMatches(annotation, FEIGN_CLIENT)) {
      continue;
    }
    return annotationStringAttribute(annotation, "path") ?? "";
  }
  return "";
}

export function extractFeignClientEndpoints(type: JvmTypeModel): string[] {
  const feignPrefix = extractFeignClientPathPrefix(type);
  const springClassPrefix = extractSpringClassPathPrefix(type);
  const classPathPrefix = joinPathPrefixes(feignPrefix, springClassPrefix);
  return extractSpringEndpoints(type, classPathPrefix);
}

function isFeignClientAnnotation(
  annotation: { readonly name: string },
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): boolean {
  if (annotationMatches(annotation, FEIGN_CLIENT)) {
    const resolved = resolveTypeName(annotation.name, importContext, language);
    if (resolved === FEIGN_CLIENT_FQCN || resolved.endsWith(`.${FEIGN_CLIENT}`)) {
      return true;
    }
    if (!annotation.name.includes(".")) {
      return true;
    }
  }
  const resolved = resolveTypeName(annotation.name, importContext, language);
  return resolved === FEIGN_CLIENT_FQCN;
}
