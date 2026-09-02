import type { JavaMethodDeclaration, JavaTypeRef } from "../java/java-ast-model.js";
import { resolveKotlinTypeFqcn } from "./kotlin-type-resolver.js";
import type {
  KotlinCompilationUnit,
  KotlinFunctionDeclaration,
  KotlinMethodDeclaration,
  KotlinTypeDeclaration,
} from "./kotlin-ast-model.js";
import { micronautRouteBuilderProfile } from "../java/rest/profiles/micronaut-route-builder-profile.js";

export function typeImplementsRouteBuilder(
  type: KotlinTypeDeclaration,
  packageName: string | undefined,
  imports: ReadonlyMap<string, string>,
): boolean {
  for (const interfaceType of type.interfaces) {
    const fqcn = resolveKotlinTypeFqcn(interfaceType, packageName, imports);
    if ((micronautRouteBuilderProfile.routeBuilderTypeNames as readonly string[]).includes(fqcn)) {
      return true;
    }
    if (interfaceType.simpleName === "RouteBuilder") {
      return true;
    }
  }

  if (type.superClass) {
    const superFqcn = resolveKotlinTypeFqcn(type.superClass, packageName, imports);
    if ((micronautRouteBuilderProfile.routeBuilderTypeNames as readonly string[]).includes(superFqcn)) {
      return true;
    }
    if (
      type.superClass.simpleName === "DefaultRouteBuilder" ||
      type.superClass.simpleName === "RouteBuilder"
    ) {
      return true;
    }
  }

  return false;
}

export function findKotlinFunctionByName(
  compilationUnit: KotlinCompilationUnit,
  enclosingType: KotlinTypeDeclaration | undefined,
  name: string,
): KotlinMethodDeclaration | undefined {
  if (enclosingType) {
    const method = enclosingType.methods.find((candidate) => candidate.name === name);
    if (method) {
      return method;
    }
  }

  return compilationUnit.topLevelFunctions.find((candidate) => candidate.name === name);
}

export function adaptKotlinMethodToJava(method: KotlinMethodDeclaration): JavaMethodDeclaration {
  return {
    name: method.name,
    returnType: method.returnType,
    parameters: method.parameters.map((parameter) => ({
      name: parameter.name,
      type: parameter.type,
      annotations: parameter.annotations,
    })),
    annotations: method.annotations,
    isSuspend: method.isSuspend,
  };
}

export function findTypeDeclarationByRef(
  compilationUnit: KotlinCompilationUnit,
  typeRef: JavaTypeRef | undefined,
): KotlinTypeDeclaration | undefined {
  if (!typeRef) {
    return undefined;
  }

  const fqcn = resolveKotlinTypeFqcn(typeRef, compilationUnit.packageName, compilationUnit.imports);
  const simpleName = fqcn.split(".").at(-1) ?? fqcn;

  function search(types: readonly KotlinTypeDeclaration[]): KotlinTypeDeclaration | undefined {
    for (const type of types) {
      if (type.fqcn === fqcn || type.name === simpleName) {
        return type;
      }

      const nested = search(type.nestedTypes);
      if (nested) {
        return nested;
      }
    }

    return undefined;
  }

  return search(compilationUnit.types);
}

export function listAllKotlinFunctions(
  compilationUnit: KotlinCompilationUnit,
  enclosingType?: KotlinTypeDeclaration,
): KotlinFunctionDeclaration[] {
  const functions: KotlinFunctionDeclaration[] = compilationUnit.topLevelFunctions.map((fn) => ({
    ...fn,
    isTopLevel: true,
  }));

  if (enclosingType) {
    for (const method of enclosingType.methods) {
      functions.push({ ...method, isTopLevel: false });
    }
  }

  for (const type of compilationUnit.types) {
    functions.push(
      ...type.methods.map((method) => ({
        ...method,
        isTopLevel: false,
        enclosingTypeFqcn: type.fqcn,
      })),
    );
  }

  return functions;
}
