import type {
  JavaCompilationUnit,
  JavaFieldDeclaration,
  JavaMethodDeclaration,
  JavaTypeDeclaration,
} from "../java-ast-model.js";
import { firstChild } from "../java-cst-utils.js";
import { resolveTypeFqcn } from "../java-type-resolver.js";
import { extractFunctionalRoutes, isRouterFunctionType } from "./functional-route-builder.js";
import { findTypeDeclarationByRef, typeImplementsRouteBuilder } from "./functional-type-utils.js";
import {
  extractMicronautRoutes,
  resolveMicronautHandlerParameterType,
  type MicronautHandlerBinding,
} from "./micronaut-route-extractor.js";
import { springRouterFunctionProfile } from "./profiles/spring-router-function-profile.js";
import {
  extractQuarkusReactiveRoutes,
  typeHasRouteMethods,
} from "./quarkus-reactive-route-extractor.js";
import {
  extractQuarkusVertxRoutes,
  methodHasRouterParameter,
} from "./quarkus-vertx-route-extractor.js";
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

function buildTypeMetadata(
  compilationUnit: JavaCompilationUnit,
  enclosingType: JavaTypeDeclaration,
): Pick<ParsedFunctionalRouter, "implementedInterfaceFqcn" | "baseClassFqcn"> {
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
    implementedInterfaceFqcn,
    ...(baseClassFqcn ? { baseClassFqcn } : {}),
  };
}

function findMethodsByName(
  methods: readonly JavaMethodDeclaration[],
  names: readonly string[],
): JavaMethodDeclaration[] {
  const nameSet = new Set(names);
  return methods.filter((method) => nameSet.has(method.name));
}

function resolveMicronautHandlers(
  compilationUnit: JavaCompilationUnit,
  enclosingType: JavaTypeDeclaration,
  method: JavaMethodDeclaration,
  bindings: readonly MicronautHandlerBinding[],
): JavaMethodDeclaration[] {
  const handlers: JavaMethodDeclaration[] = [];

  for (const binding of bindings) {
    let controllerType: JavaTypeDeclaration | undefined = enclosingType;

    if (!binding.usesThis) {
      const parameterType = resolveMicronautHandlerParameterType(binding, method.parameters);
      controllerType = findTypeDeclarationByRef(compilationUnit, parameterType);
    }

    if (!controllerType) {
      continue;
    }

    const handler = findMethodsByName(controllerType.methods, [binding.handlerMethodName])[0];
    if (handler) {
      handlers.push(handler);
    }
  }

  return handlers;
}

function buildRouter(
  compilationUnit: JavaCompilationUnit,
  enclosingType: JavaTypeDeclaration,
  memberName: string,
  endpoints: readonly string[],
  handlerMethods: readonly JavaMethodDeclaration[],
): ParsedFunctionalRouter | undefined {
  if (endpoints.length === 0) {
    return undefined;
  }

  const registry = createDefaultRestAnnotationRegistry();

  return {
    name: memberName,
    fqcn: `${enclosingType.fqcn}#${memberName}`,
    dtoFqcn: collectDtoFqcn(
      handlerMethods,
      compilationUnit.packageName,
      compilationUnit.imports,
      registry,
    ),
    endpoints,
    tcpStackType: resolveTcpStackType(handlerMethods),
    ...buildTypeMetadata(compilationUnit, enclosingType),
  };
}

function buildClassRouter(
  compilationUnit: JavaCompilationUnit,
  enclosingType: JavaTypeDeclaration,
  endpoints: readonly string[],
  handlerMethods: readonly JavaMethodDeclaration[],
): ParsedFunctionalRouter | undefined {
  if (endpoints.length === 0) {
    return undefined;
  }

  const registry = createDefaultRestAnnotationRegistry();

  return {
    name: enclosingType.name,
    fqcn: enclosingType.fqcn,
    dtoFqcn: collectDtoFqcn(
      handlerMethods,
      compilationUnit.packageName,
      compilationUnit.imports,
      registry,
    ),
    endpoints,
    tcpStackType: resolveTcpStackType(handlerMethods),
    ...buildTypeMetadata(compilationUnit, enclosingType),
  };
}

function isBeanRouterMethod(
  method: JavaMethodDeclaration,
  packageName: string | undefined,
  imports: ReadonlyMap<string, string>,
): boolean {
  return (
    hasAnnotationName(method.annotations, springRouterFunctionProfile.beanAnnotationNames) &&
    isRouterFunctionType(method.returnType, packageName, imports)
  );
}

function isRouterFunctionField(
  field: JavaFieldDeclaration,
  packageName: string | undefined,
  imports: ReadonlyMap<string, string>,
): boolean {
  return (
    field.initializer !== undefined &&
    isRouterFunctionType(field.type, packageName, imports) &&
    !hasAnnotationName(field.annotations, springRouterFunctionProfile.beanAnnotationNames)
  );
}

function extractInitializerExpression(
  initializer: JavaFieldDeclaration["initializer"],
): JavaFieldDeclaration["initializer"] {
  if (!initializer) {
    return undefined;
  }

  return firstChild(initializer, "expression") ?? initializer;
}

function extractSpringBeanRouters(
  compilationUnit: JavaCompilationUnit,
  type: JavaTypeDeclaration,
): ParsedFunctionalRouter[] {
  const routers: ParsedFunctionalRouter[] = [];

  for (const method of type.methods) {
    if (!isBeanRouterMethod(method, compilationUnit.packageName, compilationUnit.imports)) {
      continue;
    }

    const routeExtraction = extractFunctionalRoutes(method.body);
    const handlerMethods = findMethodsByName(type.methods, routeExtraction.handlerMethodNames);
    const router = buildRouter(
      compilationUnit,
      type,
      method.name,
      routeExtraction.endpoints,
      handlerMethods,
    );
    if (router) {
      routers.push(router);
    }
  }

  return routers;
}

function extractSpringFieldRouters(
  compilationUnit: JavaCompilationUnit,
  type: JavaTypeDeclaration,
): ParsedFunctionalRouter[] {
  const routers: ParsedFunctionalRouter[] = [];

  for (const field of type.fields) {
    if (!isRouterFunctionField(field, compilationUnit.packageName, compilationUnit.imports)) {
      continue;
    }

    const routeExtraction = extractFunctionalRoutes(extractInitializerExpression(field.initializer));
    const handlerMethods = findMethodsByName(type.methods, routeExtraction.handlerMethodNames);
    const router = buildRouter(
      compilationUnit,
      type,
      field.name,
      routeExtraction.endpoints,
      handlerMethods,
    );
    if (router) {
      routers.push(router);
    }
  }

  return routers;
}

function extractMicronautRouters(
  compilationUnit: JavaCompilationUnit,
  type: JavaTypeDeclaration,
): ParsedFunctionalRouter[] {
  if (!typeImplementsRouteBuilder(type, compilationUnit.packageName, compilationUnit.imports)) {
    return [];
  }

  const routers: ParsedFunctionalRouter[] = [];

  for (const method of type.methods) {
    const routeExtraction = extractMicronautRoutes(method.body);
    const handlerMethods = resolveMicronautHandlers(
      compilationUnit,
      type,
      method,
      routeExtraction.handlerBindings,
    );
    const router = buildRouter(
      compilationUnit,
      type,
      method.name,
      routeExtraction.endpoints,
      handlerMethods,
    );
    if (router) {
      routers.push(router);
    }
  }

  return routers;
}

function extractQuarkusVertxRouters(
  compilationUnit: JavaCompilationUnit,
  type: JavaTypeDeclaration,
): ParsedFunctionalRouter[] {
  const routers: ParsedFunctionalRouter[] = [];

  for (const method of type.methods) {
    const hasObservesRouter = method.parameters.some((parameter) =>
      parameter.annotations.some((annotation) => annotation.name === "Observes"),
    );
    if (
      !methodHasRouterParameter(method.parameters, compilationUnit.imports) &&
      !hasObservesRouter
    ) {
      continue;
    }

    const routeExtraction = extractQuarkusVertxRoutes(method.body);
    const router = buildRouter(compilationUnit, type, method.name, routeExtraction.endpoints, []);
    if (router) {
      routers.push(router);
    }
  }

  return routers;
}

function extractQuarkusReactiveClassRouter(
  compilationUnit: JavaCompilationUnit,
  type: JavaTypeDeclaration,
): ParsedFunctionalRouter | undefined {
  if (!typeHasRouteMethods(type.methods)) {
    return undefined;
  }

  const routeExtraction = extractQuarkusReactiveRoutes(type.methods);
  const routeMethods = type.methods.filter((method) =>
    method.annotations.some(
      (annotation) => annotation.name === "Route" || annotation.qualifiedName.endsWith(".Route"),
    ),
  );

  return buildClassRouter(compilationUnit, type, routeExtraction.endpoints, routeMethods);
}

function extractRoutersFromType(
  compilationUnit: JavaCompilationUnit,
  type: JavaTypeDeclaration,
): ParsedFunctionalRouter[] {
  const routers: ParsedFunctionalRouter[] = [
    ...extractSpringBeanRouters(compilationUnit, type),
    ...extractSpringFieldRouters(compilationUnit, type),
    ...extractMicronautRouters(compilationUnit, type),
    ...extractQuarkusVertxRouters(compilationUnit, type),
  ];

  const reactiveRouter = extractQuarkusReactiveClassRouter(compilationUnit, type);
  if (reactiveRouter) {
    routers.push(reactiveRouter);
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
