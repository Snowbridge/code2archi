import type {
  JavaCompilationUnit,
  JavaMethodDeclaration,
  JavaTypeDeclaration,
} from "../java-ast-model.js";
import {
  APACHE_HTTP_CLIENT_FRAMEWORK,
  detectApacheClientFramework,
} from "./apache-http-client-extractor.js";
import {
  detectJdkHttpClientFramework,
} from "./jdk-http-client-extractor.js";
import { resolveTcpStackType, type TcpStackType } from "../rest/rest-tcp-stack-type.js";
import {
  collectJavaInheritedContractTypes,
  collectJavaPublicMethodPayloadTypes,
} from "./programmatic-client-metadata.js";
import {
  collectJavaClassHttpEndpoints,
  extractJavaHttpEndpointsFromBody,
} from "./programmatic-http-endpoints.js";

export interface ParsedProgrammaticRestClient {
  readonly name: string;
  readonly fqcn: string;
  readonly endpoints: readonly string[];
  readonly tcpStackType: TcpStackType;
  readonly clientFramework: string;
  readonly dtoFqcn: readonly string[];
  readonly inheritedContractTypeNames: readonly string[];
  readonly baseUrl?: string;
}

const WEB_CLIENT_TYPE_NAMES = new Set(["WebClient", "WebClient.Builder"]);
const REST_TEMPLATE_TYPE_NAMES = new Set(["RestTemplate"]);
const SPRING_REST_CLIENT_TYPE_NAMES = new Set(["RestClient", "RestClient.Builder"]);
const OKHTTP_TYPE_NAMES = new Set(["OkHttpClient", "Request", "Request.Builder"]);

function typeSimpleName(typeRef: JavaMethodDeclaration["returnType"]): string | undefined {
  return typeRef?.simpleName;
}

function flattenTypes(types: readonly JavaTypeDeclaration[]): JavaTypeDeclaration[] {
  const flattened: JavaTypeDeclaration[] = [];
  for (const type of types) {
    flattened.push(type);
    flattened.push(...flattenTypes(type.nestedTypes));
  }
  return flattened;
}

function detectClientFramework(
  type: JavaTypeDeclaration,
  imports: ReadonlyMap<string, string>,
): string | undefined {
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
  }

  if ([...typeNames].some((name) => WEB_CLIENT_TYPE_NAMES.has(name))) {
    return "webclient";
  }
  if ([...typeNames].some((name) => SPRING_REST_CLIENT_TYPE_NAMES.has(name))) {
    return "spring-rest-client";
  }
  if ([...typeNames].some((name) => REST_TEMPLATE_TYPE_NAMES.has(name))) {
    return "rest-template";
  }
  if ([...typeNames].some((name) => OKHTTP_TYPE_NAMES.has(name))) {
    return "okhttp";
  }

  const apacheFramework = detectApacheClientFramework(type, imports);
  if (apacheFramework) {
    return apacheFramework;
  }

  const jdkFramework = detectJdkHttpClientFramework(type, imports);
  if (jdkFramework) {
    return jdkFramework;
  }

  const fqcnLower = type.fqcn.toLowerCase();
  if (fqcnLower.includes("webclient") || type.name.toLowerCase().includes("webclient")) {
    return "webclient";
  }
  if (fqcnLower.includes("okhttp") || type.name.toLowerCase().includes("okhttp")) {
    return "okhttp";
  }

  return undefined;
}

function extractClassClient(
  compilationUnit: JavaCompilationUnit,
  type: JavaTypeDeclaration,
): ParsedProgrammaticRestClient | undefined {
  if (type.name.startsWith("Abstract")) {
    return undefined;
  }

  const clientFramework = detectClientFramework(type, compilationUnit.imports);
  if (!clientFramework) {
    return undefined;
  }

  const { endpoints, handlerMethods } = collectJavaClassHttpEndpoints(type, clientFramework);
  if (endpoints.length === 0) {
    return undefined;
  }

  return {
    name: type.name,
    fqcn: type.fqcn,
    endpoints,
    tcpStackType: resolveTcpStackType(handlerMethods),
    clientFramework,
    dtoFqcn: collectJavaPublicMethodPayloadTypes(compilationUnit, type),
    inheritedContractTypeNames: collectJavaInheritedContractTypes(compilationUnit, type),
  };
}

export function extractProgrammaticRestClients(
  compilationUnit: JavaCompilationUnit,
): ParsedProgrammaticRestClient[] {
  const clients: ParsedProgrammaticRestClient[] = [];

  for (const type of flattenTypes(compilationUnit.types)) {
    const classClient = extractClassClient(compilationUnit, type);
    if (classClient) {
      clients.push(classClient);
    }
  }

  return clients;
}

export {
  APACHE_HTTP_CLIENT_FRAMEWORK,
  WEB_CLIENT_TYPE_NAMES,
  SPRING_REST_CLIENT_TYPE_NAMES,
  extractJavaHttpEndpointsFromBody,
};
