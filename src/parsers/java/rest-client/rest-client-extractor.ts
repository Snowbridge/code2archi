import { getAnnotationAttribute } from "../java-annotation-utils.js";
import type { JavaCompilationUnit, JavaMethodDeclaration, JavaTypeDeclaration } from "../java-ast-model.js";
import { resolveTypeFqcn } from "../java-type-resolver.js";
import { collectDtoFqcn, filterHandlerMethods } from "../rest/rest-dto-collector.js";
import {
  buildClassBasePaths,
  buildEndpointsForMethod,
} from "../rest/rest-endpoint-builder.js";
import { resolveTcpStackType, type TcpStackType } from "../rest/rest-tcp-stack-type.js";
import { ModuleTypeIndex } from "./module-type-index.js";
import {
  createDefaultRestClientProfileBundle,
  type RestClientProfileBundle,
} from "./rest-client-annotation-registry.js";

export interface ParsedRestClient {
  readonly name: string;
  readonly fqcn: string;
  readonly dtoFqcn: readonly string[];
  readonly endpoints: readonly string[];
  readonly tcpStackType: TcpStackType;
  readonly clientFramework: string;
  readonly extendedInterfaceFqcn: readonly string[];
  readonly serviceName?: string;
  readonly baseUrl?: string;
}

function flattenTypes(types: readonly JavaTypeDeclaration[]): JavaTypeDeclaration[] {
  const flattened: JavaTypeDeclaration[] = [];
  for (const type of types) {
    flattened.push(type);
    flattened.push(...flattenTypes(type.nestedTypes));
  }
  return flattened;
}

function readFeignMetadata(annotations: JavaTypeDeclaration["annotations"]): {
  serviceName?: string;
  baseUrl?: string;
} {
  const feignAnnotation = annotations.find(
    (annotation) =>
      annotation.name === "FeignClient" ||
      annotation.qualifiedName === "org.springframework.cloud.openfeign.FeignClient",
  );
  if (!feignAnnotation) {
    return {};
  }

  const nameAttr =
    getAnnotationAttribute(feignAnnotation, "name") ??
    getAnnotationAttribute(feignAnnotation, "value");
  const urlAttr = getAnnotationAttribute(feignAnnotation, "url");

  return {
    ...(typeof nameAttr === "string" && nameAttr.length > 0 ? { serviceName: nameAttr } : {}),
    ...(typeof urlAttr === "string" && urlAttr.length > 0 ? { baseUrl: urlAttr } : {}),
  };
}

function collectHandlerMethods(
  compilationUnit: JavaCompilationUnit,
  type: JavaTypeDeclaration,
  index: ModuleTypeIndex,
  bundle: RestClientProfileBundle,
): JavaMethodDeclaration[] {
  const methods = new Map<string, JavaMethodDeclaration>();

  const ownHandlers = filterHandlerMethods(type.methods, bundle.mappingRegistry);
  for (const method of ownHandlers) {
    methods.set(method.name, method);
  }

  for (const inherited of index.collectInheritedTypes(compilationUnit, type)) {
    const inheritedHandlers = filterHandlerMethods(
      inherited.type.methods,
      bundle.mappingRegistry,
    );
    for (const method of inheritedHandlers) {
      if (!methods.has(method.name)) {
        methods.set(method.name, method);
      }
    }
  }

  return [...methods.values()];
}

function extractClientFromType(
  compilationUnit: JavaCompilationUnit,
  type: JavaTypeDeclaration,
  index: ModuleTypeIndex,
  bundle: RestClientProfileBundle,
): ParsedRestClient | undefined {
  let profile = bundle.detectProfile(type.annotations);
  if (!profile) {
    profile = bundle.detectRetrofitInterface(type);
  }
  if (!profile) {
    return undefined;
  }

  const handlerMethods = collectHandlerMethods(compilationUnit, type, index, bundle);
  if (handlerMethods.length === 0) {
    return undefined;
  }

  const classPaths = buildClassBasePaths(type.annotations, bundle.mappingRegistry);
  const endpoints = new Set<string>();

  const allClassPathSources: JavaTypeDeclaration[] = [type];
  for (const inherited of index.collectInheritedTypes(compilationUnit, type)) {
    allClassPathSources.push(inherited.type);
  }

  const mergedClassPaths = new Set<string>();
  for (const pathSource of allClassPathSources) {
    for (const classPath of buildClassBasePaths(pathSource.annotations, bundle.mappingRegistry)) {
      mergedClassPaths.add(classPath);
    }
  }
  const effectiveClassPaths = mergedClassPaths.size > 0 ? [...mergedClassPaths] : classPaths;

  for (const method of handlerMethods) {
    for (const endpoint of buildEndpointsForMethod(
      effectiveClassPaths,
      method.annotations,
      bundle.mappingRegistry,
    )) {
      endpoints.add(endpoint);
    }
  }

  const extendedInterfaceFqcn = type.interfaces
    .map((interfaceType) =>
      resolveTypeFqcn(interfaceType, compilationUnit.packageName, compilationUnit.imports),
    )
    .sort();

  const feignMetadata = readFeignMetadata(type.annotations);

  return {
    name: type.name,
    fqcn: type.fqcn,
    dtoFqcn: collectDtoFqcn(
      handlerMethods,
      compilationUnit.packageName,
      compilationUnit.imports,
      bundle.mappingRegistry,
    ),
    endpoints: [...endpoints].sort(),
    tcpStackType: resolveTcpStackType(handlerMethods),
    clientFramework: profile.id,
    extendedInterfaceFqcn,
    ...feignMetadata,
  };
}

export function extractRestClientsFromCompilationUnit(
  compilationUnit: JavaCompilationUnit,
  index: ModuleTypeIndex,
  bundle: RestClientProfileBundle = createDefaultRestClientProfileBundle(),
): ParsedRestClient[] {
  const clients: ParsedRestClient[] = [];

  for (const type of flattenTypes(compilationUnit.types)) {
    const client = extractClientFromType(compilationUnit, type, index, bundle);
    if (client) {
      clients.push(client);
    }
  }

  return clients;
}

export function extractRestClientsForModule(
  compilationUnits: readonly JavaCompilationUnit[],
  bundle: RestClientProfileBundle = createDefaultRestClientProfileBundle(),
): ParsedRestClient[] {
  const index = new ModuleTypeIndex();
  for (const compilationUnit of compilationUnits) {
    index.addCompilationUnit(compilationUnit);
  }

  const clients: ParsedRestClient[] = [];
  for (const compilationUnit of compilationUnits) {
    clients.push(...extractRestClientsFromCompilationUnit(compilationUnit, index, bundle));
  }

  return clients;
}
