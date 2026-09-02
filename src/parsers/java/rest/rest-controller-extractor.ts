import type { JavaCompilationUnit, JavaTypeDeclaration } from "../java-ast-model.js";
import { resolveTypeFqcn } from "../java-type-resolver.js";
import {
  createDefaultRestAnnotationRegistry,
  type RestAnnotationRegistry,
} from "./rest-annotation-registry.js";
import { collectDtoFqcn, filterHandlerMethods, resolveDtoSourceMethods } from "./rest-dto-collector.js";
import {
  buildClassBasePaths,
  buildEndpointsForMethod,
  methodHasMapping,
} from "./rest-endpoint-builder.js";
import { jaxRsProfile } from "./profiles/jax-rs-profile.js";
import { micronautProfile } from "./profiles/micronaut-profile.js";
import { springMvcProfile } from "./profiles/spring-mvc-profile.js";
import { resolveTcpStackType, type TcpStackType } from "./rest-tcp-stack-type.js";

export interface ParsedRestController {
  readonly name: string;
  readonly fqcn: string;
  readonly dtoFqcn: readonly string[];
  readonly endpoints: readonly string[];
  readonly tcpStackType: TcpStackType;
  readonly baseClassFqcn?: string;
  readonly implementedInterfaceFqcn: readonly string[];
  readonly framework: string;
}

function hasAnnotationName(
  annotations: readonly { readonly name: string; readonly qualifiedName: string }[],
  names: readonly string[],
): boolean {
  const nameSet = new Set(names);
  return annotations.some(
    (annotation) =>
      nameSet.has(annotation.name) || nameSet.has(annotation.qualifiedName),
  );
}

function isSpringController(type: JavaTypeDeclaration): boolean {
  return hasAnnotationName(type.annotations, springMvcProfile.controllerMarkerNames);
}

function isJaxRsController(type: JavaTypeDeclaration): boolean {
  return hasAnnotationName(type.annotations, jaxRsProfile.controllerMarkerNames);
}

function isMicronautController(type: JavaTypeDeclaration): boolean {
  return hasAnnotationName(type.annotations, micronautProfile.controllerMarkerNames);
}

function detectFramework(type: JavaTypeDeclaration): string | undefined {
  if (isMicronautController(type)) {
    return micronautProfile.id;
  }
  if (isSpringController(type)) {
    return springMvcProfile.id;
  }
  if (isJaxRsController(type)) {
    return jaxRsProfile.id;
  }
  return undefined;
}

function isControllerCandidate(
  type: JavaTypeDeclaration,
  handlerMethods: readonly { readonly annotations: readonly unknown[] }[],
): boolean {
  const framework = detectFramework(type);
  if (!framework) {
    return false;
  }

  if (framework === springMvcProfile.id) {
    const hasRestController = hasAnnotationName(type.annotations, [
      "RestController",
      "org.springframework.web.bind.annotation.RestController",
    ]);
    if (hasRestController) {
      return true;
    }
    return handlerMethods.length > 0;
  }

  if (framework === jaxRsProfile.id || framework === micronautProfile.id) {
    return handlerMethods.length > 0;
  }

  return false;
}

function extractControllerFromType(
  compilationUnit: JavaCompilationUnit,
  type: JavaTypeDeclaration,
  registry: RestAnnotationRegistry,
): ParsedRestController | undefined {
  const handlerMethods = filterHandlerMethods(type.methods, registry);
  if (!isControllerCandidate(type, handlerMethods)) {
    return undefined;
  }

  const framework = detectFramework(type);
  if (!framework) {
    return undefined;
  }

  const classPaths = buildClassBasePaths(type.annotations, registry);
  const endpoints = new Set<string>();
  for (const method of handlerMethods) {
    for (const endpoint of buildEndpointsForMethod(classPaths, method.annotations, registry)) {
      endpoints.add(endpoint);
    }
  }

  const implementedInterfaceFqcn = type.interfaces
    .map((interfaceType) =>
      resolveTypeFqcn(interfaceType, compilationUnit.packageName, compilationUnit.imports),
    )
    .sort();

  const baseClassFqcn =
    type.superClass &&
    resolveTypeFqcn(type.superClass, compilationUnit.packageName, compilationUnit.imports) !==
      "java.lang.Object"
      ? resolveTypeFqcn(type.superClass, compilationUnit.packageName, compilationUnit.imports)
      : undefined;

  return {
    name: type.name,
    fqcn: type.fqcn,
    dtoFqcn: collectDtoFqcn(
      resolveDtoSourceMethods(type, handlerMethods, framework),
      compilationUnit.packageName,
      compilationUnit.imports,
      registry,
    ),
    endpoints: [...endpoints].sort(),
    tcpStackType: resolveTcpStackType(handlerMethods),
    implementedInterfaceFqcn,
    framework,
    ...(baseClassFqcn ? { baseClassFqcn } : {}),
  };
}

function flattenTypes(types: readonly JavaTypeDeclaration[]): JavaTypeDeclaration[] {
  const flattened: JavaTypeDeclaration[] = [];
  for (const type of types) {
    flattened.push(type);
    flattened.push(...flattenTypes(type.nestedTypes));
  }
  return flattened;
}

export function extractRestControllers(
  compilationUnit: JavaCompilationUnit,
  registry: RestAnnotationRegistry = createDefaultRestAnnotationRegistry(),
): ParsedRestController[] {
  const controllers: ParsedRestController[] = [];

  for (const type of flattenTypes(compilationUnit.types)) {
    const controller = extractControllerFromType(compilationUnit, type, registry);
    if (controller) {
      controllers.push(controller);
    }
  }

  return controllers;
}
