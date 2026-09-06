import type {
  KotlinCompilationUnit,
  KotlinMethodDeclaration,
} from "./kotlin-ast-model.js";
import type { JavaMethodDeclaration } from "../java/java-ast-model.js";
import { resolveTcpStackType } from "../java/rest/rest-tcp-stack-type.js";
import type { ParsedProgrammaticRestClient } from "../java/rest-client/programmatic-http-client-extractor.js";
import { collectPayloadTypesFromJavaMethods } from "../java/rest-client/programmatic-client-metadata.js";
import { extractKotlinHttpEndpointsFromBody } from "./kotlin-programmatic-http-endpoints.js";

const WEB_CLIENT_TYPE_NAMES = new Set(["WebClient", "WebClient.Builder"]);
const KTRO_CLIENT_TYPE_NAMES = new Set(["HttpClient"]);

function buildTopLevelFqcn(compilationUnit: KotlinCompilationUnit, memberName: string): string {
  const facade = compilationUnit.packageName
    ? `${compilationUnit.packageName}.${compilationUnit.fileBaseName}Kt`
    : `${compilationUnit.fileBaseName}Kt`;
  return `${facade}#${memberName}`;
}

function typeSimpleName(typeRef?: { readonly simpleName: string }): string | undefined {
  return typeRef?.simpleName;
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
    visibility: "public",
    isSuspend: method.isSuspend,
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

  const endpoints = extractKotlinHttpEndpointsFromBody(method.body, clientFramework);
  if (endpoints.length === 0) {
    return undefined;
  }

  const javaMethod = toJavaMethod(method);

  return {
    name: method.name,
    fqcn: buildTopLevelFqcn(compilationUnit, method.name),
    endpoints,
    tcpStackType: resolveTcpStackType([javaMethod]),
    clientFramework,
    dtoFqcn: collectPayloadTypesFromJavaMethods(
      {
        packageName: compilationUnit.packageName,
        imports: compilationUnit.imports,
        types: [],
      },
      [javaMethod],
    ),
    inheritedContractTypeNames: [],
  };
}

export function extractKotlinTopLevelRestClients(
  compilationUnit: KotlinCompilationUnit,
): ParsedProgrammaticRestClient[] {
  const clients: ParsedProgrammaticRestClient[] = [];

  for (const method of compilationUnit.topLevelFunctions) {
    const topLevelClient = extractTopLevelClient(compilationUnit, method);
    if (topLevelClient) {
      clients.push(topLevelClient);
    }
  }

  return clients;
}
