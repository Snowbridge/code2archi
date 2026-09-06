import type {
  KotlinCompilationUnit,
  KotlinMethodDeclaration,
} from "./kotlin-ast-model.js";
import type { JavaMethodDeclaration } from "../java/java-ast-model.js";
import { resolveTcpStackType } from "../java/rest/rest-tcp-stack-type.js";
import type { ParsedProgrammaticRestClient } from "../java/rest-client/programmatic-http-client-extractor.js";
import { collectKotlinTopLevelPublicPayloadTypes } from "../java/rest-client/programmatic-client-metadata.js";
import {
  collectCallExpressions,
  extractStringLiteral,
} from "./kotlin-functional-cst-utils.js";
import { extractKotlinHttpEndpointsFromBody } from "./kotlin-programmatic-http-endpoints.js";
import { hasKotlinProgrammaticRestClientClass } from "./kotlin-programmatic-rest-client-extractor.js";

const WEB_CLIENT_TYPE_NAMES = new Set(["WebClient", "WebClient.Builder"]);
const KTRO_CLIENT_TYPE_NAMES = new Set(["HttpClient"]);

function buildFileKtFqcn(compilationUnit: KotlinCompilationUnit): string {
  return compilationUnit.packageName
    ? `${compilationUnit.packageName}.${compilationUnit.fileBaseName}Kt`
    : `${compilationUnit.fileBaseName}Kt`;
}

function typeSimpleName(typeRef?: { readonly simpleName: string }): string | undefined {
  return typeRef?.simpleName;
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

  return inferFrameworkFromMethodBody(method);
}

function toJavaMethod(method: KotlinMethodDeclaration): JavaMethodDeclaration {
  return {
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
  };
}

function isQualifyingTopLevelFunction(
  method: KotlinMethodDeclaration,
  clientFramework: string,
): boolean {
  const methodFramework = detectTopLevelFramework(method);
  if (!methodFramework || methodFramework !== clientFramework) {
    return false;
  }
  return extractKotlinHttpEndpointsFromBody(method.body, clientFramework).length > 0;
}

function extractFileKtClient(
  compilationUnit: KotlinCompilationUnit,
): ParsedProgrammaticRestClient | undefined {
  if (hasKotlinProgrammaticRestClientClass(compilationUnit)) {
    return undefined;
  }

  let clientFramework: string | undefined;
  for (const method of compilationUnit.topLevelFunctions) {
    const methodFramework = detectTopLevelFramework(method);
    if (!methodFramework) {
      continue;
    }
    const endpoints = extractKotlinHttpEndpointsFromBody(method.body, methodFramework);
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

  for (const method of compilationUnit.topLevelFunctions) {
    if (!isQualifyingTopLevelFunction(method, clientFramework)) {
      continue;
    }
    handlerMethods.push(toJavaMethod(method));
    for (const endpoint of extractKotlinHttpEndpointsFromBody(method.body, clientFramework)) {
      endpoints.add(endpoint);
    }
  }

  if (endpoints.size === 0) {
    return undefined;
  }

  const fileKtFqcn = buildFileKtFqcn(compilationUnit);
  const fileKtName = `${compilationUnit.fileBaseName}Kt`;

  return {
    name: fileKtName,
    fqcn: fileKtFqcn,
    endpoints: [...endpoints].sort(),
    tcpStackType: resolveTcpStackType(handlerMethods),
    clientFramework,
    dtoFqcn: collectKotlinTopLevelPublicPayloadTypes(compilationUnit),
    inheritedContractTypeNames: [],
  };
}

export function extractKotlinTopLevelRestClients(
  compilationUnit: KotlinCompilationUnit,
): ParsedProgrammaticRestClient[] {
  const fileKtClient = extractFileKtClient(compilationUnit);
  return fileKtClient ? [fileKtClient] : [];
}
