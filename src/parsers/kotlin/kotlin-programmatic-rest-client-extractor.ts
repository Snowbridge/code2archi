import type { SyntaxNode } from "tree-sitter";
import type {
  KotlinCompilationUnit,
  KotlinMethodDeclaration,
  KotlinTypeDeclaration,
} from "./kotlin-ast-model.js";
import {
  collectCallExpressions,
  extractStringLiteral,
} from "./kotlin-functional-cst-utils.js";
import type { JavaMethodDeclaration } from "../java/java-ast-model.js";
import { formatEndpoint } from "../java/rest/rest-path-normalizer.js";
import { resolveTcpStackType } from "../java/rest/rest-tcp-stack-type.js";
import type { ParsedProgrammaticRestClient } from "../java/rest-client/programmatic-http-client-extractor.js";

const WEB_CLIENT_TYPE_NAMES = new Set(["WebClient", "WebClient.Builder"]);
const KTRO_CLIENT_TYPE_NAMES = new Set(["HttpClient"]);
const OKHTTP_TYPE_NAMES = new Set(["OkHttpClient", "Request", "Request.Builder"]);

const URI_METHOD_NAMES = new Set(["uri", "url", "fromHttpUrl", "fromUriString"]);
const HTTP_VERB_NAMES = new Set(["get", "post", "put", "delete", "patch", "head", "options"]);

function buildTopLevelFqcn(compilationUnit: KotlinCompilationUnit, memberName: string): string {
  const facade = compilationUnit.packageName
    ? `${compilationUnit.packageName}.${compilationUnit.fileBaseName}Kt`
    : `${compilationUnit.fileBaseName}Kt`;
  return `${facade}#${memberName}`;
}

function typeSimpleName(typeRef?: { readonly simpleName: string }): string | undefined {
  return typeRef?.simpleName;
}

function detectClientFramework(type: KotlinTypeDeclaration): string | undefined {
  const typeNames = new Set<string>();

  for (const property of type.properties) {
    const simple = typeSimpleName(property.type);
    if (simple) {
      typeNames.add(simple);
    }
  }

  for (const method of type.methods) {
    for (const parameter of method.parameters) {
      const simple = typeSimpleName(parameter.type);
      if (simple) {
        typeNames.add(simple);
      }
    }

    const returnSimple = typeSimpleName(method.returnType);
    if (returnSimple) {
      typeNames.add(returnSimple);
    }
  }

  if ([...typeNames].some((name) => WEB_CLIENT_TYPE_NAMES.has(name))) {
    return "webclient";
  }
  if ([...typeNames].some((name) => KTRO_CLIENT_TYPE_NAMES.has(name))) {
    return "ktor-client";
  }
  if ([...typeNames].some((name) => OKHTTP_TYPE_NAMES.has(name))) {
    return "okhttp";
  }

  const fqcnLower = type.fqcn.toLowerCase();
  if (fqcnLower.includes("webclient") || type.name.toLowerCase().includes("webclient")) {
    return "webclient";
  }

  return undefined;
}

function detectTopLevelFramework(method: KotlinMethodDeclaration): string | undefined {
  for (const parameter of method.parameters) {
    const simple = typeSimpleName(parameter.type);
    if (simple && KTRO_CLIENT_TYPE_NAMES.has(simple)) {
      return "ktor-client";
    }
    if (simple && WEB_CLIENT_TYPE_NAMES.has(simple)) {
      return "webclient";
    }
  }

  return undefined;
}

function toJavaMethods(methods: readonly KotlinMethodDeclaration[]): JavaMethodDeclaration[] {
  return methods.map((method) => ({
    name: method.name,
    returnType: method.returnType,
    parameters: method.parameters.map((parameter) => ({
      name: parameter.name,
      type: parameter.type,
      annotations: parameter.annotations,
    })),
    annotations: method.annotations,
    isSuspend: method.isSuspend,
  }));
}

function parseHttpMethodFromName(methodName: string): string | undefined {
  const upper = methodName.toUpperCase();
  if (HTTP_VERB_NAMES.has(methodName.toLowerCase())) {
    return upper;
  }
  return undefined;
}

function extractEndpointsFromBody(
  body: SyntaxNode | undefined,
  clientFramework: string,
): string[] {
  if (!body) {
    return [];
  }

  const endpoints = new Set<string>();
  let pendingHttpMethod: string | undefined;

  collectCallExpressions(body, (methodName, args) => {
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

    const verbMethod = parseHttpMethodFromName(methodName);
    if (verbMethod && args.length > 0) {
      const pathLiteral = extractStringLiteral(args[0]);
      if (pathLiteral) {
        endpoints.add(formatEndpoint(verbMethod as "GET", pathLiteral));
        return;
      }
      if (clientFramework === "ktor-client") {
        pendingHttpMethod = verbMethod;
      }
    }
  });

  return [...endpoints].sort();
}

function extractClassClient(
  type: KotlinTypeDeclaration,
): ParsedProgrammaticRestClient | undefined {
  if (type.name.startsWith("Abstract")) {
    return undefined;
  }

  const clientFramework = detectClientFramework(type);
  if (!clientFramework) {
    return undefined;
  }

  const endpoints = new Set<string>();
  const handlerMethods: KotlinMethodDeclaration[] = [];

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
    tcpStackType: resolveTcpStackType(toJavaMethods(handlerMethods)),
    clientFramework,
  };
}

function extractTopLevelClient(
  compilationUnit: KotlinCompilationUnit,
  method: KotlinMethodDeclaration,
): ParsedProgrammaticRestClient | undefined {
  const clientFramework = detectTopLevelFramework(method);
  if (!clientFramework) {
    return undefined;
  }

  const endpoints = extractEndpointsFromBody(method.body, clientFramework);
  if (endpoints.length === 0) {
    return undefined;
  }

  return {
    name: method.name,
    fqcn: buildTopLevelFqcn(compilationUnit, method.name),
    endpoints,
    tcpStackType: resolveTcpStackType(toJavaMethods([method])),
    clientFramework,
  };
}

export function extractKotlinProgrammaticRestClients(
  compilationUnit: KotlinCompilationUnit,
): ParsedProgrammaticRestClient[] {
  const clients: ParsedProgrammaticRestClient[] = [];

  for (const type of compilationUnit.types) {
    const classClient = extractClassClient(type);
    if (classClient) {
      clients.push(classClient);
    }
  }

  for (const method of compilationUnit.topLevelFunctions) {
    const topLevelClient = extractTopLevelClient(compilationUnit, method);
    if (topLevelClient) {
      clients.push(topLevelClient);
    }
  }

  return clients;
}
