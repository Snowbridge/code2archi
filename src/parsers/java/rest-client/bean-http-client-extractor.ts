import type { JavaCompilationUnit, JavaMethodDeclaration, JavaTypeDeclaration } from "../java-ast-model.js";
import { resolveTcpStackType } from "../rest/rest-tcp-stack-type.js";
import {
  collectJavaInheritedContractTypes,
  collectJavaPublicMethodPayloadTypes,
} from "./programmatic-client-metadata.js";
import {
  extractJavaHttpEndpointsFromBody,
  isEligibleProgrammaticRestClientClass,
  ParsedProgrammaticRestClient,
  SPRING_REST_CLIENT_TYPE_NAMES,
  WEB_CLIENT_TYPE_NAMES,
} from "./programmatic-http-client-extractor.js";
import { isSpringBeanMethod } from "./programmatic-http-endpoints.js";

function flattenTypes(types: readonly JavaTypeDeclaration[]): JavaTypeDeclaration[] {
  const flattened: JavaTypeDeclaration[] = [];
  for (const type of types) {
    flattened.push(type);
    flattened.push(...flattenTypes(type.nestedTypes));
  }
  return flattened;
}

function typeSimpleName(typeRef: JavaMethodDeclaration["returnType"]): string | undefined {
  return typeRef?.simpleName;
}

function detectBeanMethodFramework(method: JavaMethodDeclaration): string | undefined {
  const returnSimple = typeSimpleName(method.returnType);
  if (!returnSimple) {
    return undefined;
  }
  if (WEB_CLIENT_TYPE_NAMES.has(returnSimple)) {
    return "webclient";
  }
  if (SPRING_REST_CLIENT_TYPE_NAMES.has(returnSimple)) {
    return "spring-rest-client";
  }
  return undefined;
}

function isQualifyingBeanMethod(method: JavaMethodDeclaration, clientFramework: string): boolean {
  if (!isSpringBeanMethod(method)) {
    return false;
  }
  const methodFramework = detectBeanMethodFramework(method);
  if (!methodFramework || methodFramework !== clientFramework) {
    return false;
  }
  return extractJavaHttpEndpointsFromBody(method.body, clientFramework).length > 0;
}

function extractBeanClassClient(
  compilationUnit: JavaCompilationUnit,
  type: JavaTypeDeclaration,
): ParsedProgrammaticRestClient | undefined {
  if (isEligibleProgrammaticRestClientClass(compilationUnit, type)) {
    return undefined;
  }

  let clientFramework: string | undefined;
  for (const method of type.methods) {
    const methodFramework = detectBeanMethodFramework(method);
    if (!methodFramework || !isSpringBeanMethod(method)) {
      continue;
    }
    const endpoints = extractJavaHttpEndpointsFromBody(method.body, methodFramework);
    if (endpoints.length > 0) {
      clientFramework = methodFramework;
      break;
    }
  }

  if (!clientFramework) {
    return undefined;
  }

  const endpoints = new Set<string>();
  const handlerMethods: JavaMethodDeclaration[] = [];

  for (const method of type.methods) {
    if (!isQualifyingBeanMethod(method, clientFramework)) {
      continue;
    }
    handlerMethods.push(method);
    for (const endpoint of extractJavaHttpEndpointsFromBody(method.body, clientFramework)) {
      endpoints.add(endpoint);
    }
  }

  if (endpoints.size === 0) {
    return undefined;
  }

  return {
    name: type.name,
    fqcn: type.fqcn,
    endpoints: [...endpoints].sort(),
    tcpStackType: resolveTcpStackType(handlerMethods),
    clientFramework,
    dtoFqcn: collectJavaPublicMethodPayloadTypes(compilationUnit, type),
    inheritedContractTypeNames: collectJavaInheritedContractTypes(compilationUnit, type),
  };
}

export function extractBeanRestClients(compilationUnit: JavaCompilationUnit): ParsedProgrammaticRestClient[] {
  const clients: ParsedProgrammaticRestClient[] = [];

  for (const type of flattenTypes(compilationUnit.types)) {
    const beanClient = extractBeanClassClient(compilationUnit, type);
    if (beanClient) {
      clients.push(beanClient);
    }
  }

  return clients;
}
