import type {
  JavaCompilationUnit,
  JavaMethodDeclaration,
  JavaTypeDeclaration,
} from "../java-ast-model.js";
import type { GenericCstNode } from "../java-cst-utils.js";
import {
  APACHE_HTTP_CLIENT_FRAMEWORK,
  detectApacheClientFramework,
  extractApacheHttpEndpoints,
} from "./apache-http-client-extractor.js";
import {
  detectJdkHttpClientFramework,
} from "./jdk-http-client-extractor.js";
import { extractRestTemplatePathLiteral } from "./uri-components-builder-extractor.js";
import {
  collectPrimaryInvocations,
  extractStringLiteral,
} from "../rest/functional-cst-utils.js";
import { formatEndpoint } from "../rest/rest-path-normalizer.js";
import { resolveTcpStackType, type TcpStackType } from "../rest/rest-tcp-stack-type.js";

export interface ParsedProgrammaticRestClient {
  readonly name: string;
  readonly fqcn: string;
  readonly endpoints: readonly string[];
  readonly tcpStackType: TcpStackType;
  readonly clientFramework: string;
  readonly baseUrl?: string;
}

const WEB_CLIENT_TYPE_NAMES = new Set(["WebClient", "WebClient.Builder"]);
const REST_TEMPLATE_TYPE_NAMES = new Set(["RestTemplate"]);
const SPRING_REST_CLIENT_TYPE_NAMES = new Set(["RestClient", "RestClient.Builder"]);
const OKHTTP_TYPE_NAMES = new Set(["OkHttpClient", "Request", "Request.Builder"]);
const URI_METHOD_NAMES = new Set(["uri", "fromUriString"]);
const URL_METHOD_NAMES = new Set(["url"]);
const REST_TEMPLATE_CALLS = new Set([
  "getForEntity",
  "getForObject",
  "postForEntity",
  "postForObject",
  "put",
  "delete",
  "exchange",
  "patchForObject",
]);

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

function parseHttpMethodFromName(methodName: string): string | undefined {
  const upper = methodName.toUpperCase();
  if (upper === "GET" || upper === "POST" || upper === "PUT" || upper === "PATCH" || upper === "DELETE") {
    return upper;
  }
  if (methodName === "getForEntity" || methodName === "getForObject") {
    return "GET";
  }
  if (methodName === "postForEntity" || methodName === "postForObject") {
    return "POST";
  }
  if (methodName === "patchForObject") {
    return "PATCH";
  }
  if (methodName === "delete") {
    return "DELETE";
  }
  if (methodName === "put") {
    return "PUT";
  }
  return undefined;
}

function extractEndpointsFromBody(
  body: GenericCstNode | undefined,
  clientFramework: string,
): string[] {
  if (!body) {
    return [];
  }

  if (clientFramework === APACHE_HTTP_CLIENT_FRAMEWORK) {
    return extractApacheHttpEndpoints(body);
  }

  const endpoints = new Set<string>();
  let pendingHttpMethod: string | undefined;

  collectPrimaryInvocations(body, (methodName, args) => {
    if (methodName === "method" && args.length >= 2) {
      const methodLiteral = extractStringLiteral(args[0]);
      if (methodLiteral) {
        pendingHttpMethod = methodLiteral.toUpperCase();
      }
      const pathLiteral = extractStringLiteral(args[1]);
      if (pendingHttpMethod && pathLiteral) {
        endpoints.add(formatEndpoint(pendingHttpMethod as "GET", pathLiteral));
      }
      return;
    }

    if (URI_METHOD_NAMES.has(methodName) && args.length > 0) {
      const pathLiteral = extractStringLiteral(args[0]);
      if (pathLiteral) {
        const httpMethod = pendingHttpMethod ?? "GET";
        endpoints.add(formatEndpoint(httpMethod as "GET", pathLiteral));
      }
      pendingHttpMethod = undefined;
      return;
    }

    if (URL_METHOD_NAMES.has(methodName) && args.length > 0) {
      const pathLiteral = extractStringLiteral(args[0]);
      if (pathLiteral) {
        const httpMethod = pendingHttpMethod ?? "GET";
        endpoints.add(formatEndpoint(httpMethod as "GET", pathLiteral));
      }
      pendingHttpMethod = undefined;
      return;
    }

    if (REST_TEMPLATE_CALLS.has(methodName) && args.length > 0) {
      const pathLiteral =
        clientFramework === "rest-template"
          ? extractRestTemplatePathLiteral(args[0])
          : extractStringLiteral(args[0]);
      const httpMethod = parseHttpMethodFromName(methodName);
      if (pathLiteral && httpMethod) {
        endpoints.add(formatEndpoint(httpMethod as "GET", pathLiteral));
      }
      return;
    }

    if (methodName === "path" && args.length > 0) {
      const pathLiteral = extractStringLiteral(args[0]);
      if (pathLiteral && pendingHttpMethod) {
        endpoints.add(formatEndpoint(pendingHttpMethod as "GET", pathLiteral));
      }
    }

    if (methodName === "post" || methodName === "get" || methodName === "put" || methodName === "delete") {
      pendingHttpMethod = methodName.toUpperCase();
    }
  });

  return [...endpoints].sort();
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
  if (!returnSimple || !WEB_CLIENT_TYPE_NAMES.has(returnSimple) && !SPRING_REST_CLIENT_TYPE_NAMES.has(returnSimple)) {
    return undefined;
  }

  const clientFramework = WEB_CLIENT_TYPE_NAMES.has(returnSimple) ? "webclient" : "spring-rest-client";
  const endpoints = extractEndpointsFromBody(method.body, clientFramework);
  if (endpoints.length === 0) {
    return undefined;
  }

  return {
    name: method.name,
    fqcn: `${type.fqcn}#${method.name}`,
    endpoints,
    tcpStackType: resolveTcpStackType([method]),
    clientFramework,
  };
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

  const endpoints = new Set<string>();
  const handlerMethods: JavaMethodDeclaration[] = [];

  for (const method of type.methods) {
    const methodEndpoints = extractEndpointsFromBody(method.body, clientFramework);
    if (methodEndpoints.length > 0) {
      handlerMethods.push(method);
      for (const endpoint of methodEndpoints) {
        endpoints.add(endpoint);
      }
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
      continue;
    }

    for (const method of type.methods) {
      const beanClient = extractBeanClient(compilationUnit, type, method);
      if (beanClient) {
        clients.push(beanClient);
      }
    }
  }

  return clients;
}
