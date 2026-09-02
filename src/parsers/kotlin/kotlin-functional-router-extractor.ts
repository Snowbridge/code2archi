import type {
  KotlinCompilationUnit,
  KotlinFunctionDeclaration,
  KotlinMethodDeclaration,
  KotlinPropertyDeclaration,
  KotlinTypeDeclaration,
} from "./kotlin-ast-model.js";
import { springRouterFunctionProfile } from "../java/rest/profiles/spring-router-function-profile.js";
import { collectDtoFqcn } from "../java/rest/rest-dto-collector.js";
import { createDefaultRestAnnotationRegistry } from "../java/rest/rest-annotation-registry.js";
import { resolveTcpStackType } from "../java/rest/rest-tcp-stack-type.js";
import type { TcpStackType } from "../java/rest/rest-tcp-stack-type.js";
import type { ParsedFunctionalRouter } from "../java/rest/functional-router-extractor.js";
import {
  adaptKotlinMethodToJava,
  findKotlinFunctionByName,
  findTypeDeclarationByRef,
  typeImplementsRouteBuilder,
} from "./kotlin-functional-type-utils.js";
import {
  extractKtorRoutes,
  isKtorRouteExtension,
  isKtorRoutingHost,
} from "./ktor-route-extractor.js";
import {
  extractMicronautKotlinRoutes,
  resolveMicronautKotlinHandlerParameterType,
  type MicronautKotlinHandlerBinding,
} from "./micronaut-kotlin-route-extractor.js";
import {
  extractQuarkusReactiveKotlinRoutes,
  typeHasRouteMethods,
} from "./quarkus-reactive-kotlin-route-extractor.js";
import {
  extractQuarkusVertxKotlinRoutes,
  methodHasRouterParameter,
} from "./quarkus-vertx-kotlin-route-extractor.js";
import {
  extractSpringKotlinRoutes,
  isCoRouterFunctionType,
  isRouterFunctionType,
} from "./spring-kotlin-functional-extractor.js";
import { resolveKotlinTypeFqcn } from "./kotlin-type-resolver.js";

function hasAnnotationName(
  annotations: readonly { readonly name: string; readonly qualifiedName: string }[],
  names: readonly string[],
): boolean {
  const nameSet = new Set(names);
  return annotations.some(
    (annotation) => nameSet.has(annotation.name) || nameSet.has(annotation.qualifiedName),
  );
}

function buildTopLevelFqcn(
  compilationUnit: KotlinCompilationUnit,
  memberName: string,
): string {
  const facade = compilationUnit.packageName
    ? `${compilationUnit.packageName}.${compilationUnit.fileBaseName}Kt`
    : `${compilationUnit.fileBaseName}Kt`;
  return `${facade}#${memberName}`;
}

function buildMemberFqcn(enclosingFqcn: string, memberName: string): string {
  return `${enclosingFqcn}#${memberName}`;
}

function buildTypeMetadata(
  compilationUnit: KotlinCompilationUnit,
  enclosingType: KotlinTypeDeclaration | undefined,
): Pick<ParsedFunctionalRouter, "implementedInterfaceFqcn" | "baseClassFqcn"> {
  if (!enclosingType) {
    return { implementedInterfaceFqcn: [] };
  }

  const implementedInterfaceFqcn = enclosingType.interfaces
    .map((interfaceType) =>
      resolveKotlinTypeFqcn(interfaceType, compilationUnit.packageName, compilationUnit.imports),
    )
    .sort();

  const superFqcn =
    enclosingType.superClass &&
    resolveKotlinTypeFqcn(
      enclosingType.superClass,
      compilationUnit.packageName,
      compilationUnit.imports,
    ) !== "java.lang.Object"
      ? resolveKotlinTypeFqcn(
          enclosingType.superClass,
          compilationUnit.packageName,
          compilationUnit.imports,
        )
      : undefined;

  return {
    implementedInterfaceFqcn,
    ...(superFqcn && superFqcn !== "Any" ? { baseClassFqcn: superFqcn } : {}),
  };
}

function resolveHandlers(
  compilationUnit: KotlinCompilationUnit,
  enclosingType: KotlinTypeDeclaration | undefined,
  handlerMethodNames: readonly string[],
  hostMethod?: KotlinMethodDeclaration,
): JavaMethodDeclaration[] {
  const handlers = handlerMethodNames
    .map((name) => findKotlinFunctionByName(compilationUnit, enclosingType, name))
    .filter((handler): handler is KotlinMethodDeclaration => handler !== undefined)
    .map(adaptKotlinMethodToJava);

  if (hostMethod) {
    handlers.push(adaptKotlinMethodToJava(hostMethod));
  }

  return handlers;
}

type JavaMethodDeclaration = ReturnType<typeof adaptKotlinMethodToJava>;

function buildRouter(
  compilationUnit: KotlinCompilationUnit,
  enclosingType: KotlinTypeDeclaration | undefined,
  memberName: string,
  fqcn: string,
  endpoints: readonly string[],
  handlerMethods: readonly JavaMethodDeclaration[],
): ParsedFunctionalRouter | undefined {
  if (endpoints.length === 0) {
    return undefined;
  }

  const registry = createDefaultRestAnnotationRegistry();

  return {
    name: memberName,
    fqcn,
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
  compilationUnit: KotlinCompilationUnit,
  enclosingType: KotlinTypeDeclaration,
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

function isBeanRouterFunction(
  fn: KotlinMethodDeclaration,
  compilationUnit: KotlinCompilationUnit,
): boolean {
  return (
    hasAnnotationName(fn.annotations, springRouterFunctionProfile.beanAnnotationNames) &&
    (isRouterFunctionType(fn.returnType, compilationUnit.packageName, compilationUnit.imports) ||
      isCoRouterFunctionType(fn.returnType, compilationUnit.packageName, compilationUnit.imports))
  );
}

function isRouterFunctionProperty(
  property: KotlinPropertyDeclaration,
  compilationUnit: KotlinCompilationUnit,
): boolean {
  return (
    property.initializer !== undefined &&
    (isRouterFunctionType(property.type, compilationUnit.packageName, compilationUnit.imports) ||
      isCoRouterFunctionType(property.type, compilationUnit.packageName, compilationUnit.imports)) &&
    !hasAnnotationName(property.annotations, springRouterFunctionProfile.beanAnnotationNames)
  );
}

function resolveMicronautHandlers(
  compilationUnit: KotlinCompilationUnit,
  enclosingType: KotlinTypeDeclaration,
  method: KotlinMethodDeclaration,
  bindings: readonly MicronautKotlinHandlerBinding[],
): JavaMethodDeclaration[] {
  const handlers: JavaMethodDeclaration[] = [];

  for (const binding of bindings) {
    let controllerType: KotlinTypeDeclaration | undefined = enclosingType;

    if (!binding.usesThis) {
      const parameterType = resolveMicronautKotlinHandlerParameterType(binding, method.parameters);
      controllerType = findTypeDeclarationByRef(compilationUnit, parameterType);
    }

    if (!controllerType) {
      continue;
    }

    const handler = controllerType.methods.find(
      (candidate) => candidate.name === binding.handlerMethodName,
    );
    if (handler) {
      handlers.push(adaptKotlinMethodToJava(handler));
    }
  }

  return handlers;
}

function extractSpringFunctionRouters(
  compilationUnit: KotlinCompilationUnit,
  enclosingType: KotlinTypeDeclaration | undefined,
  fn: KotlinFunctionDeclaration,
): ParsedFunctionalRouter | undefined {
  if (!isBeanRouterFunction(fn, compilationUnit)) {
    return undefined;
  }

  const routeExtraction = extractSpringKotlinRoutes(fn.body);
  const fqcn = fn.isTopLevel
    ? buildTopLevelFqcn(compilationUnit, fn.name)
    : buildMemberFqcn(enclosingType?.fqcn ?? compilationUnit.fileBaseName, fn.name);

  const handlers = resolveHandlers(
    compilationUnit,
    enclosingType,
    routeExtraction.handlerMethodNames,
    fn,
  );
  const routerFqcn = fn.returnType
    ? resolveKotlinTypeFqcn(fn.returnType, compilationUnit.packageName, compilationUnit.imports)
    : "";
  const reactiveRouter = routerFqcn.includes(".reactive.");
  const tcpStackType =
    isCoRouterFunctionType(fn.returnType, compilationUnit.packageName, compilationUnit.imports) ||
    fn.isSuspend ||
    reactiveRouter
      ? ("NON_BLOCKING" as const)
      : resolveTcpStackType(handlers);

  const router = buildRouter(
    compilationUnit,
    enclosingType,
    fn.name,
    fqcn,
    routeExtraction.endpoints,
    handlers,
  );

  if (!router) {
    return undefined;
  }

  return { ...router, tcpStackType };
}

function extractSpringPropertyRouters(
  compilationUnit: KotlinCompilationUnit,
  enclosingType: KotlinTypeDeclaration | undefined,
  property: KotlinPropertyDeclaration,
): ParsedFunctionalRouter | undefined {
  if (!isRouterFunctionProperty(property, compilationUnit)) {
    return undefined;
  }

  const routeExtraction = extractSpringKotlinRoutes(property.initializer);
  const fqcn = enclosingType
    ? buildMemberFqcn(enclosingType.fqcn, property.name)
    : buildTopLevelFqcn(compilationUnit, property.name);

  return buildRouter(
    compilationUnit,
    enclosingType,
    property.name,
    fqcn,
    routeExtraction.endpoints,
    resolveHandlers(compilationUnit, enclosingType, routeExtraction.handlerMethodNames),
  );
}

function extractKtorFunctionRouter(
  compilationUnit: KotlinCompilationUnit,
  enclosingType: KotlinTypeDeclaration | undefined,
  fn: KotlinFunctionDeclaration,
): ParsedFunctionalRouter | undefined {
  const isHost = isKtorRoutingHost(fn.body);
  const isExtension = isKtorRouteExtension(
    fn.receiverType,
    compilationUnit.packageName,
    compilationUnit.imports,
  );

  if (!isHost && !isExtension) {
    return undefined;
  }

  const routeExtraction = extractKtorRoutes(fn.body);
  const fqcn = fn.isTopLevel
    ? buildTopLevelFqcn(compilationUnit, fn.name)
    : buildMemberFqcn(enclosingType?.fqcn ?? compilationUnit.fileBaseName, fn.name);

  return buildRouter(
    compilationUnit,
    enclosingType,
    fn.name,
    fqcn,
    routeExtraction.endpoints,
    [adaptKotlinMethodToJava(fn)],
  );
}

function extractMicronautRouters(
  compilationUnit: KotlinCompilationUnit,
  type: KotlinTypeDeclaration,
): ParsedFunctionalRouter[] {
  if (!typeImplementsRouteBuilder(type, compilationUnit.packageName, compilationUnit.imports)) {
    return [];
  }

  const routers: ParsedFunctionalRouter[] = [];

  for (const method of type.methods) {
    const routeExtraction = extractMicronautKotlinRoutes(method.body);
    const router = buildRouter(
      compilationUnit,
      type,
      method.name,
      buildMemberFqcn(type.fqcn, method.name),
      routeExtraction.endpoints,
      resolveMicronautHandlers(compilationUnit, type, method, routeExtraction.handlerBindings),
    );
    if (router) {
      routers.push(router);
    }
  }

  return routers;
}

function extractQuarkusVertxRouters(
  compilationUnit: KotlinCompilationUnit,
  type: KotlinTypeDeclaration,
): ParsedFunctionalRouter[] {
  const routers: ParsedFunctionalRouter[] = [];

  for (const method of type.methods) {
    if (!methodHasRouterParameter(method.parameters, compilationUnit.imports)) {
      continue;
    }

    const routeExtraction = extractQuarkusVertxKotlinRoutes(method.body);
    const router = buildRouter(
      compilationUnit,
      type,
      method.name,
      buildMemberFqcn(type.fqcn, method.name),
      routeExtraction.endpoints,
      [],
    );
    if (router) {
      routers.push(router);
    }
  }

  return routers;
}

function extractQuarkusReactiveClassRouter(
  compilationUnit: KotlinCompilationUnit,
  type: KotlinTypeDeclaration,
): ParsedFunctionalRouter | undefined {
  if (!typeHasRouteMethods(type.methods)) {
    return undefined;
  }

  const routeExtraction = extractQuarkusReactiveKotlinRoutes(type.methods);
  const routeMethods = type.methods.filter((method) =>
    method.annotations.some(
      (annotation) => annotation.name === "Route" || annotation.qualifiedName.endsWith(".Route"),
    ),
  );

  return buildClassRouter(
    compilationUnit,
    type,
    routeExtraction.endpoints,
    routeMethods.map(adaptKotlinMethodToJava),
  );
}

function extractFromFunctions(
  compilationUnit: KotlinCompilationUnit,
  enclosingType: KotlinTypeDeclaration | undefined,
  functions: readonly KotlinFunctionDeclaration[],
): ParsedFunctionalRouter[] {
  const routers: ParsedFunctionalRouter[] = [];

  for (const fn of functions) {
    const springRouter = extractSpringFunctionRouters(compilationUnit, enclosingType, fn);
    if (springRouter) {
      routers.push(springRouter);
      continue;
    }

    const ktorRouter = extractKtorFunctionRouter(compilationUnit, enclosingType, fn);
    if (ktorRouter) {
      routers.push(ktorRouter);
    }
  }

  return routers;
}

function extractFromProperties(
  compilationUnit: KotlinCompilationUnit,
  enclosingType: KotlinTypeDeclaration | undefined,
  properties: readonly KotlinPropertyDeclaration[],
): ParsedFunctionalRouter[] {
  const routers: ParsedFunctionalRouter[] = [];

  for (const property of properties) {
    const router = extractSpringPropertyRouters(compilationUnit, enclosingType, property);
    if (router) {
      routers.push(router);
    }
  }

  return routers;
}

function extractRoutersFromType(
  compilationUnit: KotlinCompilationUnit,
  type: KotlinTypeDeclaration,
): ParsedFunctionalRouter[] {
  const routers: ParsedFunctionalRouter[] = [
    ...extractFromFunctions(
      compilationUnit,
      type,
      type.methods.map((method) => ({ ...method, isTopLevel: false })),
    ),
    ...extractFromProperties(compilationUnit, type, type.properties),
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

export function extractKotlinFunctionalRouters(
  compilationUnit: KotlinCompilationUnit,
): ParsedFunctionalRouter[] {
  const routers: ParsedFunctionalRouter[] = [
    ...extractFromFunctions(compilationUnit, undefined, compilationUnit.topLevelFunctions),
    ...extractFromProperties(compilationUnit, undefined, compilationUnit.topLevelProperties),
  ];

  for (const type of compilationUnit.types) {
    routers.push(...extractRoutersFromType(compilationUnit, type));
  }

  return routers;
}

// Re-export for typing in processor
export type { TcpStackType };
