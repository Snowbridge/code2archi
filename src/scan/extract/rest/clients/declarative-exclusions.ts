import { annotationMatches } from "../../../../parsers/jvm/extract-jvm-file.js";
import type { JvmTypeModel } from "../../../../parsers/jvm/types.js";

const DECLARATIVE_TYPE_ANNOTATIONS = [
  "FeignClient",
  "RegisterRestClient",
] as const;

const RETROFIT_HTTP_ANNOTATIONS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HTTP",
] as const;

export function isDeclarativeRestClient(type: JvmTypeModel): boolean {
  for (const annotation of type.annotations) {
    for (const marker of DECLARATIVE_TYPE_ANNOTATIONS) {
      if (annotationMatches(annotation, marker)) {
        return true;
      }
    }
  }

  for (const annotation of type.annotations) {
    for (const marker of RETROFIT_HTTP_ANNOTATIONS) {
      if (annotationMatches(annotation, marker)) {
        return true;
      }
    }
  }

  for (const method of type.methods) {
    for (const annotation of method.annotations) {
      for (const marker of RETROFIT_HTTP_ANNOTATIONS) {
        if (annotationMatches(annotation, marker)) {
          return true;
        }
      }
    }
  }

  return false;
}
