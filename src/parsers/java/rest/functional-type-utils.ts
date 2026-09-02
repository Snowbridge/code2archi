import type { JavaCompilationUnit, JavaTypeDeclaration, JavaTypeRef } from "../java-ast-model.js";
import { resolveTypeFqcn } from "../java-type-resolver.js";
import { micronautRouteBuilderProfile } from "./profiles/micronaut-route-builder-profile.js";

export function typeImplementsRouteBuilder(
  type: JavaTypeDeclaration,
  packageName: string | undefined,
  imports: ReadonlyMap<string, string>,
): boolean {
  for (const interfaceType of type.interfaces) {
    const fqcn = resolveTypeFqcn(interfaceType, packageName, imports);
    if ((micronautRouteBuilderProfile.routeBuilderTypeNames as readonly string[]).includes(fqcn)) {
      return true;
    }
    if (interfaceType.simpleName === "RouteBuilder") {
      return true;
    }
  }

  if (type.superClass) {
    const superFqcn = resolveTypeFqcn(type.superClass, packageName, imports);
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

export function findTypeDeclarationByRef(
  compilationUnit: JavaCompilationUnit,
  typeRef: JavaTypeRef | undefined,
): JavaTypeDeclaration | undefined {
  if (!typeRef) {
    return undefined;
  }

  const fqcn = resolveTypeFqcn(typeRef, compilationUnit.packageName, compilationUnit.imports);
  const simpleName = fqcn.split(".").at(-1) ?? fqcn;

  function search(types: readonly JavaTypeDeclaration[]): JavaTypeDeclaration | undefined {
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
