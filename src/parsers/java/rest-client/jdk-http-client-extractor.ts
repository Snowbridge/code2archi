import type { JavaTypeDeclaration } from "../java-ast-model.js";

export const JAVA_HTTP_CLIENT_FRAMEWORK = "java-http" as const;

const JDK_HTTP_TYPE_NAMES = new Set(["HttpClient", "HttpRequest", "HttpRequest.Builder"]);

function typeSimpleName(typeRef: { readonly simpleName: string } | undefined): string | undefined {
  return typeRef?.simpleName;
}

function hasJdkHttpImports(imports: ReadonlyMap<string, string>): boolean {
  for (const qualifiedName of imports.values()) {
    if (qualifiedName.startsWith("java.net.http.")) {
      return true;
    }
  }
  return false;
}

function collectReferencedTypeNames(type: JavaTypeDeclaration): Set<string> {
  const typeNames = new Set<string>();

  for (const field of type.fields) {
    const simple = typeSimpleName(field.type);
    if (simple) {
      typeNames.add(simple);
    }
  }

  for (const method of type.methods) {
    const returnSimple = typeSimpleName(method.returnType);
    if (returnSimple) {
      typeNames.add(returnSimple);
    }

    for (const parameter of method.parameters) {
      const parameterSimple = typeSimpleName(parameter.type);
      if (parameterSimple) {
        typeNames.add(parameterSimple);
      }
    }
  }

  return typeNames;
}

export function detectJdkHttpClientFramework(
  type: JavaTypeDeclaration,
  imports: ReadonlyMap<string, string>,
): string | undefined {
  const typeNames = collectReferencedTypeNames(type);
  const hasJdkTypes = [...typeNames].some((name) => JDK_HTTP_TYPE_NAMES.has(name));
  if (!hasJdkTypes) {
    return undefined;
  }

  if (hasJdkHttpImports(imports)) {
    return JAVA_HTTP_CLIENT_FRAMEWORK;
  }

  for (const importKey of imports.keys()) {
    if (importKey.startsWith("java.net.http.")) {
      return JAVA_HTTP_CLIENT_FRAMEWORK;
    }
  }

  return JAVA_HTTP_CLIENT_FRAMEWORK;
}
