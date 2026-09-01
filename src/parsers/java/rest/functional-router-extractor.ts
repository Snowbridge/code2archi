import type { JavaCompilationUnit, JavaMethodDeclaration, JavaTypeDeclaration } from "../java-ast-model.js";
import { resolveTypeFqcn } from "../java-type-resolver.js";
import { extractFunctionalRoutes } from "./functional-route-builder.js";
import { springRouterFunctionProfile } from "./profiles/spring-router-function-profile.js";
import { collectDtoFqcn } from "./rest-dto-collector.js";
import { createDefaultRestAnnotationRegistry } from "./rest-annotation-registry.js";
import { resolveTcpStackType } from "./rest-tcp-stack-type.js";
import type { TcpStackType } from "./rest-tcp-stack-type.js";

export interface ParsedFunctionalRouter {
  readonly name: string;
  readonly fqcn: string;
  readonly dtoFqcn: readonly string[];
  readonly endpoints: readonly string[];
  readonly tcpStackType: TcpStackType;
  readonly baseClassFqcn?: string;
  readonly implementedInterfaceFqcn: readonly string[];
}

function hasAnnotationName(
  annotations: readonly { readonly name: string; readonly qualifiedName: string }[],
  names: readonly string[],
): boolean {
  const nameSet = new Set(names);
  return annotations.some(
    (annotation) => nameSet.has(annotation.name) || nameSet.has(annotation.qualifiedName),
  );
}

function isRouterFunctionReturnType(
  method: JavaMethodDeclaration,
  packageName: string | undefined,
  imports: ReadonlyMap<string, string>,
): boolean {
  if (!method.returnType) {
    return false;
  }

  const fqcn = resolveTypeFqcn(method.returnType, packageName, imports);
  return springRouterFunctionProfile.routerFunctionTypeNames.some(
    (typeName) => fqcn === typeName || method.returnType?.simpleName === "RouterFunction",
  );
}

function isBeanRouterMethod(
  method: JavaMethodDeclaration,
  packageName: string | undefined,
  imports: ReadonlyMap<string, string>,
): boolean {
  return (
    hasAnnotationName(method.annotations, springRouterFunctionProfile.beanAnnotationNames) &&
    isRouterFunctionReturnType(method, packageName, imports)
  );
}

function findMethodsByName(
  methods: readonly JavaMethodDeclaration[],
  names: readonly string[],
): JavaMethodDeclaration[] {
  const nameSet = new Set(names);
  return methods.filter((method) => nameSet.has(method.name));
}

function extractRouterFromBeanMethod(
  compilationUnit: JavaCompilationUnit,
  enclosingType: JavaTypeDeclaration,
  method: JavaMethodDeclaration,
): ParsedFunctionalRouter | undefined {
  const routeExtraction = extractFunctionalRoutes(method.body);
  if (routeExtraction.endpoints.length === 0) {
    return undefined;
  }

  const handlerMethods = findMethodsByName(enclosingType.methods, routeExtraction.handlerMethodNames);
  const registry = createDefaultRestAnnotationRegistry();

  const implementedInterfaceFqcn = enclosingType.interfaces
    .map((interfaceType) =>
      resolveTypeFqcn(interfaceType, compilationUnit.packageName, compilationUnit.imports),
    )
    .sort();

  const baseClassFqcn =
    enclosingType.superClass &&
    resolveTypeFqcn(
      enclosingType.superClass,
      compilationUnit.packageName,
      compilationUnit.imports,
    ) !== "java.lang.Object"
      ? resolveTypeFqcn(
          enclosingType.superClass,
          compilationUnit.packageName,
          compilationUnit.imports,
        )
      : undefined;

  return {
    name: method.name,
    fqcn: `${enclosingType.fqcn}#${method.name}`,
    dtoFqcn: collectDtoFqcn(
      handlerMethods,
      compilationUnit.packageName,
      compilationUnit.imports,
      registry,
    ),
    endpoints: routeExtraction.endpoints,
    tcpStackType: resolveTcpStackType(handlerMethods),
    implementedInterfaceFqcn,
    ...(baseClassFqcn ? { baseClassFqcn } : {}),
  };
}

function extractRoutersFromType(
  compilationUnit: JavaCompilationUnit,
  type: JavaTypeDeclaration,
): ParsedFunctionalRouter[] {
  const routers: ParsedFunctionalRouter[] = [];

  for (const method of type.methods) {
    if (!isBeanRouterMethod(method, compilationUnit.packageName, compilationUnit.imports)) {
      continue;
    }

    const router = extractRouterFromBeanMethod(compilationUnit, type, method);
    if (router) {
      routers.push(router);
    }
  }

  for (const nestedType of type.nestedTypes) {
    routers.push(...extractRoutersFromType(compilationUnit, nestedType));
  }

  return routers;
}

export function extractFunctionalRouters(compilationUnit: JavaCompilationUnit): ParsedFunctionalRouter[] {
  const routers: ParsedFunctionalRouter[] = [];

  for (const type of compilationUnit.types) {
    routers.push(...extractRoutersFromType(compilationUnit, type));
  }

  return routers;
}
