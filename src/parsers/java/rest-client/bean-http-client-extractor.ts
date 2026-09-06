import type { JavaCompilationUnit, JavaMethodDeclaration, JavaTypeDeclaration } from "../java-ast-model.js";
import { resolveTcpStackType } from "../rest/rest-tcp-stack-type.js";
import { collectPayloadTypesFromJavaMethods } from "./programmatic-client-metadata.js";
import {
  extractJavaHttpEndpointsFromBody,
  ParsedProgrammaticRestClient,
  SPRING_REST_CLIENT_TYPE_NAMES,
  WEB_CLIENT_TYPE_NAMES,
} from "./programmatic-http-client-extractor.js";

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

function isBeanMethod(method: JavaMethodDeclaration): boolean {
  return method.annotations.some(
    (annotation) =>
      annotation.name === "Bean" ||
      annotation.qualifiedName === "org.springframework.context.annotation.Bean",
  );
}

function extractBeanClient(
  compilationUnit: JavaCompilationUnit,
  type: JavaTypeDeclaration,
  method: JavaMethodDeclaration,
): ParsedProgrammaticRestClient | undefined {
  if (!isBeanMethod(method)) {
    return undefined;
  }

  const returnSimple = typeSimpleName(method.returnType);
  if (
    !returnSimple ||
    (!WEB_CLIENT_TYPE_NAMES.has(returnSimple) && !SPRING_REST_CLIENT_TYPE_NAMES.has(returnSimple))
  ) {
    return undefined;
  }

  const clientFramework = WEB_CLIENT_TYPE_NAMES.has(returnSimple) ? "webclient" : "spring-rest-client";
  const endpoints = extractJavaHttpEndpointsFromBody(method.body, clientFramework);
  if (endpoints.length === 0) {
    return undefined;
  }

  return {
    name: method.name,
    fqcn: `${type.fqcn}#${method.name}`,
    endpoints,
    tcpStackType: resolveTcpStackType([method]),
    clientFramework,
    dtoFqcn: collectPayloadTypesFromJavaMethods(compilationUnit, [method]),
    inheritedContractTypeNames: [],
  };
}

export function extractBeanRestClients(compilationUnit: JavaCompilationUnit): ParsedProgrammaticRestClient[] {
  const clients: ParsedProgrammaticRestClient[] = [];

  for (const type of flattenTypes(compilationUnit.types)) {
    for (const method of type.methods) {
      const beanClient = extractBeanClient(compilationUnit, type, method);
      if (beanClient) {
        clients.push(beanClient);
      }
    }
  }

  return clients;
}
