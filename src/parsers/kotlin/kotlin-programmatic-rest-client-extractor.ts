import type { SyntaxNode } from "tree-sitter";
import type {
  KotlinCompilationUnit,
  KotlinMethodDeclaration,
  KotlinPropertyDeclaration,
  KotlinTypeDeclaration,
} from "./kotlin-ast-model.js";
import {
  collectCallExpressions,
  extractStringLiteral,
} from "./kotlin-functional-cst-utils.js";
import { findDirectChild, nodeText } from "./kotlin-tree-sitter-utils.js";
import type { JavaMethodDeclaration } from "../java/java-ast-model.js";
import { resolveTcpStackType } from "../java/rest/rest-tcp-stack-type.js";
import type { ParsedProgrammaticRestClient } from "../java/rest-client/programmatic-http-client-extractor.js";
import {
  collectKotlinInheritedContractTypes,
  collectKotlinPublicMethodPayloadTypes,
} from "../java/rest-client/programmatic-client-metadata.js";
import {
  collectKotlinMethodHttpEndpoints,
  extractKotlinHttpEndpointsFromBody,
} from "./kotlin-programmatic-http-endpoints.js";

const WEB_CLIENT_TYPE_NAMES = new Set(["WebClient", "WebClient.Builder"]);
const KTRO_CLIENT_TYPE_NAMES = new Set(["HttpClient"]);
const OKHTTP_TYPE_NAMES = new Set(["OkHttpClient", "Request", "Request.Builder"]);

function typeSimpleName(typeRef?: { readonly simpleName: string }): string | undefined {
  return typeRef?.simpleName;
}

function inferTypeNameFromInitializer(initializer: SyntaxNode | undefined): string | undefined {
  if (!initializer) {
    return undefined;
  }

  const callExpression =
    initializer.type === "call_expression" ? initializer : findDirectChild(initializer, "call_expression");
  if (!callExpression) {
    return undefined;
  }

  const callee = callExpression.childForFieldName("function");
  if (!callee) {
    return undefined;
  }

  if (callee.type === "simple_identifier" || callee.type === "type_identifier") {
    return nodeText(callee);
  }

  const navigation = findDirectChild(callee, "navigation_expression");
  if (navigation) {
    const identifier = findDirectChild(navigation, "simple_identifier");
    if (identifier) {
      return nodeText(identifier);
    }
  }

  return undefined;
}

function inferFrameworkFromProperty(property: KotlinPropertyDeclaration): string | undefined {
  const simple = typeSimpleName(property.type) ?? inferTypeNameFromInitializer(property.initializer);
  if (!simple) {
    return undefined;
  }

  if (WEB_CLIENT_TYPE_NAMES.has(simple)) {
    return "webclient";
  }
  if (KTRO_CLIENT_TYPE_NAMES.has(simple)) {
    return "ktor-client";
  }
  if (OKHTTP_TYPE_NAMES.has(simple)) {
    return "okhttp";
  }

  return undefined;
}

function inferFrameworkFromMethodBody(method: KotlinMethodDeclaration): string | undefined {
  if (!method.body) {
    return undefined;
  }

  let hasNewCall = false;
  let hasUrl = false;
  let hasGet = false;
  let hasUri = false;

  collectCallExpressions(method.body, (methodName, args) => {
    if (methodName === "newCall") {
      hasNewCall = true;
    }
    if (methodName === "url" && extractStringLiteral(args[0])) {
      hasUrl = true;
    }
    if (methodName === "get") {
      hasGet = true;
    }
    if (methodName === "uri" && extractStringLiteral(args[0])) {
      hasUri = true;
    }
  });

  if (hasNewCall && hasUrl) {
    return "okhttp";
  }
  if (hasGet && hasUri) {
    return "webclient";
  }

  return undefined;
}

function detectClientFramework(type: KotlinTypeDeclaration): string | undefined {
  const typeNames = new Set<string>();

  for (const property of type.properties) {
    const inferred = inferFrameworkFromProperty(property);
    if (inferred) {
      return inferred;
    }

    const simple = typeSimpleName(property.type) ?? inferTypeNameFromInitializer(property.initializer);
    if (simple) {
      typeNames.add(simple);
    }
  }

  for (const method of type.methods) {
    const inferred = inferFrameworkFromMethodBody(method);
    if (inferred) {
      return inferred;
    }

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
    visibility: method.visibility === "public" ? "public" : "private",
    isSuspend: method.isSuspend,
  }));
}

function extractClassClient(
  compilationUnit: KotlinCompilationUnit,
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
    const methodEndpoints = collectKotlinMethodHttpEndpoints(method, clientFramework);
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
    dtoFqcn: collectKotlinPublicMethodPayloadTypes(compilationUnit, type),
    inheritedContractTypeNames: collectKotlinInheritedContractTypes(compilationUnit, type),
  };
}

export function extractKotlinProgrammaticRestClients(
  compilationUnit: KotlinCompilationUnit,
): ParsedProgrammaticRestClient[] {
  const clients: ParsedProgrammaticRestClient[] = [];

  for (const type of compilationUnit.types) {
    const classClient = extractClassClient(compilationUnit, type);
    if (classClient) {
      clients.push(classClient);
    }
  }

  return clients;
}

export function isEligibleKotlinProgrammaticRestClientClass(
  compilationUnit: KotlinCompilationUnit,
  type: KotlinTypeDeclaration,
): boolean {
  return extractClassClient(compilationUnit, type) !== undefined;
}

export function hasKotlinProgrammaticRestClientClass(
  compilationUnit: KotlinCompilationUnit,
): boolean {
  return compilationUnit.types.some((type) => isEligibleKotlinProgrammaticRestClientClass(compilationUnit, type));
}
