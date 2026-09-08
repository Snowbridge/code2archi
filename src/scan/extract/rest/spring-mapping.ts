import type { JvmAnnotation, JvmMethodModel, JvmTypeModel } from "../../../parsers/jvm/types.js";
import {
  annotationMatches,
  annotationStringAttribute,
} from "../../../parsers/jvm/extract-jvm-file.js";
import { formatHttpEndpoint, joinPathPrefixes } from "./endpoint-format.js";

const SPRING_REST_CONTROLLER = "RestController";
const SPRING_CONTROLLER = "Controller";
const SPRING_MAPPINGS = new Map<string, string>([
  ["GetMapping", "GET"],
  ["PostMapping", "POST"],
  ["PutMapping", "PUT"],
  ["DeleteMapping", "DELETE"],
  ["PatchMapping", "PATCH"],
  ["RequestMapping", "REQUEST"],
]);

export function isSpringWebMvcController(type: JvmTypeModel): boolean {
  const hasRestController = type.annotations.some((annotation) =>
    annotationMatches(annotation, SPRING_REST_CONTROLLER),
  );
  if (hasRestController) {
    return true;
  }
  const hasController = type.annotations.some((annotation) =>
    annotationMatches(annotation, SPRING_CONTROLLER),
  );
  if (!hasController) {
    return false;
  }
  if (type.annotations.some((annotation) => isSpringMappingAnnotation(annotation))) {
    return true;
  }
  return type.methods.some((method) =>
    method.annotations.some((annotation) => isSpringMappingAnnotation(annotation)),
  );
}

export function extractSpringClassPathPrefix(type: JvmTypeModel): string {
  for (const annotation of type.annotations) {
    if (!isSpringMappingAnnotation(annotation)) {
      continue;
    }
    const path = annotationStringAttribute(annotation, "path", "value");
    if (path !== undefined) {
      return path;
    }
  }
  return "";
}

export function extractSpringEndpoints(
  type: JvmTypeModel,
  classPathPrefix: string,
): string[] {
  const endpoints: string[] = [];
  for (const method of type.methods) {
    endpoints.push(...extractSpringMethodEndpoints(method, classPathPrefix));
  }
  return endpoints;
}

function extractSpringMethodEndpoints(
  method: JvmMethodModel,
  classPathPrefix: string,
): string[] {
  const endpoints: string[] = [];
  for (const annotation of method.annotations) {
    if (!isSpringMappingAnnotation(annotation)) {
      continue;
    }
    const mappingName = annotation.name.includes(".")
      ? annotation.name.slice(annotation.name.lastIndexOf(".") + 1)
      : annotation.name;
    const httpMethod = SPRING_MAPPINGS.get(mappingName) ?? "GET";
    const path = annotationStringAttribute(annotation, "path", "value") ?? "";
    const fullPath = joinPathPrefixes(classPathPrefix, path);
    if (httpMethod === "REQUEST") {
      const methodAttr = annotation.attributes.method;
      const methods = typeof methodAttr === "string"
        ? [methodAttr]
        : Array.isArray(methodAttr)
          ? methodAttr
          : ["GET"];
      for (const verb of methods) {
        endpoints.push(formatHttpEndpoint(verb.replace(/^RequestMethod\./, ""), fullPath));
      }
      continue;
    }
    endpoints.push(formatHttpEndpoint(httpMethod, fullPath));
  }
  return endpoints;
}

function isSpringMappingAnnotation(annotation: JvmAnnotation): boolean {
  for (const mapping of SPRING_MAPPINGS.keys()) {
    if (annotationMatches(annotation, mapping)) {
      return true;
    }
  }
  return false;
}

export function isSpringControllerAnnotation(annotation: JvmAnnotation): boolean {
  return (
    annotationMatches(annotation, SPRING_REST_CONTROLLER) ||
    annotationMatches(annotation, SPRING_CONTROLLER)
  );
}
