import type { JavaMethodDeclaration, JavaVisibility } from "./java-ast-model.js";
import type { KotlinMethodDeclaration, KotlinVisibility } from "../kotlin/kotlin-ast-model.js";

export function isPublicJavaMethod(method: JavaMethodDeclaration): boolean {
  return method.visibility === "public";
}

export function isPublicKotlinMethod(method: KotlinMethodDeclaration): boolean {
  return method.visibility === "public";
}

export function kotlinVisibilityToJava(visibility: KotlinVisibility): JavaVisibility {
  if (visibility === "public") {
    return "public";
  }
  if (visibility === "protected") {
    return "protected";
  }
  return "private";
}
