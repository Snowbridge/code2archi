import type { JavaTypeDeclaration } from "../java-ast-model.js";
import { extractStringLiteral } from "../rest/functional-cst-utils.js";
import { normalizePathSegment } from "../rest/rest-path-normalizer.js";

export function collectTypeStringConstants(type: JavaTypeDeclaration): Map<string, string> {
  const constants = new Map<string, string>();
  collectFieldsFromType(type, constants);
  return constants;
}

function collectFieldsFromType(type: JavaTypeDeclaration, constants: Map<string, string>): void {
  for (const field of type.fields) {
    if (field.type?.simpleName !== "String" || !field.initializer) {
      continue;
    }

    const value = extractStringLiteral(field.initializer);
    if (value !== undefined) {
      constants.set(field.name, normalizePathSegment(value));
    }
  }

  for (const nested of type.nestedTypes) {
    collectFieldsFromType(nested, constants);
  }
}

export function isPathLikeConstant(value: string): boolean {
  return value.startsWith("/") || value.includes("{");
}
