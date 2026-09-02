import type { JavaMethodDeclaration, JavaTypeDeclaration } from "../java-ast-model.js";
import type { GenericCstNode } from "../java-cst-utils.js";
import {
  childNodes,
  firstChild,
  getTokenImage,
  walkDescendants,
} from "../java-cst-utils.js";
import {
  extractStringLiteral,
  getSuffixName,
} from "../rest/functional-cst-utils.js";
import { formatEndpoint } from "../rest/rest-path-normalizer.js";

export const APACHE_HTTP_CLIENT_FRAMEWORK = "apache-http" as const;

export const APACHE_HTTP_CLIENT_TYPE_NAMES = new Set([
  "CloseableHttpClient",
  "HttpClients",
]);

const APACHE_HTTP_REQUEST_TYPE_NAMES = new Set([
  "HttpGet",
  "HttpPost",
  "HttpPut",
  "HttpDelete",
  "HttpPatch",
  "HttpHead",
  "HttpOptions",
]);

const CLASSIC_REQUEST_BUILDER_METHODS = new Set(["get", "post", "put", "delete", "patch", "head", "options"]);

const CLASS_INSTANCE_CREATION_NODES = [
  "unqualifiedClassInstanceCreationExpression",
  "qualifiedClassInstanceCreationExpression",
] as const;

function typeSimpleName(typeRef: { readonly simpleName: string } | undefined): string | undefined {
  return typeRef?.simpleName;
}

function collectTypeNames(type: JavaTypeDeclaration): Set<string> {
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

    for (const parameter of method.parameters) {
      const parameterSimple = typeSimpleName(parameter.type);
      if (parameterSimple) {
        typeNames.add(parameterSimple);
      }
    }
  }

  return typeNames;
}

export function hasApacheHttpImports(imports: ReadonlyMap<string, string>): boolean {
  for (const fqcn of imports.values()) {
    if (fqcn.startsWith("org.apache.http.") || fqcn.startsWith("org.apache.hc.")) {
      return true;
    }
  }
  return false;
}

export function hasApacheHttpRequestCreations(body: GenericCstNode | undefined): boolean {
  return extractApacheHttpEndpoints(body).length > 0;
}

export function detectApacheClientFramework(
  type: JavaTypeDeclaration,
  imports: ReadonlyMap<string, string>,
): typeof APACHE_HTTP_CLIENT_FRAMEWORK | undefined {
  const typeNames = collectTypeNames(type);

  if ([...typeNames].some((name) => APACHE_HTTP_CLIENT_TYPE_NAMES.has(name))) {
    return APACHE_HTTP_CLIENT_FRAMEWORK;
  }

  if (hasApacheHttpImports(imports)) {
    if ([...typeNames].some((name) => name === "HttpClient" || name === "ClassicRequestBuilder")) {
      return APACHE_HTTP_CLIENT_FRAMEWORK;
    }
  }

  for (const method of type.methods) {
    if (hasApacheHttpRequestCreations(method.body)) {
      return APACHE_HTTP_CLIENT_FRAMEWORK;
    }
  }

  return undefined;
}

function httpMethodFromRequestTypeName(typeName: string): string | undefined {
  if (!APACHE_HTTP_REQUEST_TYPE_NAMES.has(typeName)) {
    return undefined;
  }

  return typeName.slice(4).toUpperCase();
}

function extractCreatedTypeName(creationNode: GenericCstNode): string | undefined {
  const typeToInstantiate = firstChild(creationNode, "classOrInterfaceTypeToInstantiate");
  if (!typeToInstantiate) {
    return undefined;
  }

  const identifier = firstChild(typeToInstantiate, "Identifier");
  const identifierImage = getTokenImage(identifier);
  if (identifierImage) {
    return identifierImage;
  }

  const typeIdentifier = firstChild(typeToInstantiate, "typeIdentifier");
  const typeIdentifierImage = getTokenImage(typeIdentifier);
  if (typeIdentifierImage) {
    return typeIdentifierImage;
  }

  const parts: string[] = [];
  for (const part of walkDescendants(typeToInstantiate, "Identifier")) {
    const image = getTokenImage(part);
    if (image) {
      parts.push(image);
    }
  }

  return parts.at(-1);
}

function extractFirstArgumentLiteral(creationNode: GenericCstNode): string | undefined {
  const argumentList = firstChild(creationNode, "argumentList");
  if (!argumentList) {
    return undefined;
  }

  for (const expression of childNodes(argumentList, "expression")) {
    const literal = extractStringLiteral(expression);
    if (literal !== undefined) {
      return literal;
    }
  }

  return undefined;
}

function collectRequestCreations(body: GenericCstNode | undefined, endpoints: Set<string>): void {
  if (!body) {
    return;
  }

  for (const nodeName of CLASS_INSTANCE_CREATION_NODES) {
    for (const creationNode of walkDescendants(body, nodeName)) {
      const typeName = extractCreatedTypeName(creationNode);
      if (!typeName) {
        continue;
      }

      const httpMethod = httpMethodFromRequestTypeName(typeName);
      if (!httpMethod) {
        continue;
      }

      const pathLiteral = extractFirstArgumentLiteral(creationNode);
      if (pathLiteral) {
        endpoints.add(formatEndpoint(httpMethod as "GET", pathLiteral));
      }
    }
  }
}

function collectClassicRequestBuilderCalls(body: GenericCstNode | undefined, endpoints: Set<string>): void {
  if (!body) {
    return;
  }

  for (const primary of walkDescendants(body, "primary")) {
    const prefix = firstChild(primary, "primaryPrefix");
    const prefixIdentifiers = prefix
      ? walkDescendants(prefix, "Identifier")
          .map((identifier) => getTokenImage(identifier))
          .filter((identifier): identifier is string => Boolean(identifier))
      : [];

    const classicBuilderIndex = prefixIdentifiers.indexOf("ClassicRequestBuilder");
    if (classicBuilderIndex === -1) {
      continue;
    }

    const methodNameFromPrefix = prefixIdentifiers[classicBuilderIndex + 1];
    if (methodNameFromPrefix && CLASSIC_REQUEST_BUILDER_METHODS.has(methodNameFromPrefix)) {
      for (const primarySuffix of childNodes(primary, "primarySuffix")) {
        const invocationSuffix = firstChild(primarySuffix, "methodInvocationSuffix");
        const argumentList = firstChild(invocationSuffix, "argumentList");
        const pathLiteral = extractStringLiteral(firstChild(argumentList, "expression"));
        if (pathLiteral) {
          endpoints.add(formatEndpoint(methodNameFromPrefix.toUpperCase() as "GET", pathLiteral));
          break;
        }
      }
      continue;
    }

    for (const primarySuffix of childNodes(primary, "primarySuffix")) {
      const methodName = getSuffixName(primarySuffix);
      if (!methodName || !CLASSIC_REQUEST_BUILDER_METHODS.has(methodName)) {
        continue;
      }

      const invocationSuffix = firstChild(primarySuffix, "methodInvocationSuffix");
      const argumentList = firstChild(invocationSuffix, "argumentList");
      const pathLiteral = extractStringLiteral(firstChild(argumentList, "expression"));
      if (!pathLiteral) {
        continue;
      }

      endpoints.add(formatEndpoint(methodName.toUpperCase() as "GET", pathLiteral));
    }
  }
}

export function extractApacheHttpEndpoints(body: GenericCstNode | undefined): string[] {
  const endpoints = new Set<string>();
  collectRequestCreations(body, endpoints);
  collectClassicRequestBuilderCalls(body, endpoints);
  return [...endpoints].sort();
}

export function hasApacheHttpSignals(
  type: JavaTypeDeclaration,
  imports: ReadonlyMap<string, string>,
): boolean {
  return detectApacheClientFramework(type, imports) !== undefined;
}

export function collectApacheHttpEndpointsFromMethods(
  methods: readonly JavaMethodDeclaration[],
): string[] {
  const endpoints = new Set<string>();

  for (const method of methods) {
    for (const endpoint of extractApacheHttpEndpoints(method.body)) {
      endpoints.add(endpoint);
    }
  }

  return [...endpoints].sort();
}
