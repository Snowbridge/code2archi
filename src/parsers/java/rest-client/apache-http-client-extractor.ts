import type { JavaMethodDeclaration, JavaTypeDeclaration } from "../java-ast-model.js";
import type { GenericCstNode } from "../java-cst-utils.js";
import {
  childNodes,
  firstChild,
  getTokenImage,
  walkDescendants,
} from "../java-cst-utils.js";
import {
  collectPrimaryInvocations,
  extractIdentifierName,
  extractReferenceName,
  extractStringLiteral,
  getInvocationArgumentExpressions,
  getSuffixName,
  getTrailingPrimaryPrefixName,
} from "../rest/functional-cst-utils.js";
import { formatEndpoint } from "../rest/rest-path-normalizer.js";
import { collectTypeStringConstants, isPathLikeConstant } from "./java-string-constant-index.js";
import {
  extractUriComponentsBuilderPath,
  resolvePathArgument,
} from "./uri-components-builder-extractor.js";

export const APACHE_HTTP_CLIENT_FRAMEWORK = "apache-http" as const;

export const APACHE_HTTP_CLIENT_TYPE_NAMES = new Set([
  "CloseableHttpClient",
  "HttpClients",
  "DefaultHttpClient",
  "HttpClient",
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

export interface ApacheHttpExtractionContext {
  readonly stringConstants: ReadonlyMap<string, string>;
}

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

export function hasApacheHttpRequestCreations(
  body: GenericCstNode | undefined,
  context: ApacheHttpExtractionContext = { stringConstants: new Map() },
): boolean {
  return extractApacheHttpEndpoints(body, context).length > 0;
}

export function detectApacheClientFramework(
  type: JavaTypeDeclaration,
  imports: ReadonlyMap<string, string>,
): typeof APACHE_HTTP_CLIENT_FRAMEWORK | undefined {
  const typeNames = collectTypeNames(type);
  const stringConstants = collectTypeStringConstants(type);
  const context: ApacheHttpExtractionContext = { stringConstants };

  if ([...typeNames].some((name) => APACHE_HTTP_CLIENT_TYPE_NAMES.has(name)) && hasApacheHttpImports(imports)) {
    return APACHE_HTTP_CLIENT_FRAMEWORK;
  }

  if (hasApacheHttpImports(imports)) {
    if ([...typeNames].some((name) => name === "HttpClient" || name === "ClassicRequestBuilder")) {
      return APACHE_HTTP_CLIENT_FRAMEWORK;
    }
  }

  for (const method of type.methods) {
    if (hasApacheHttpRequestCreations(method.body, context)) {
      return APACHE_HTTP_CLIENT_FRAMEWORK;
    }
  }

  if (hasApacheHttpImports(imports) && hasApacheHttpExecutePattern(type)) {
    return APACHE_HTTP_CLIENT_FRAMEWORK;
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

function extractFirstArgumentExpression(creationNode: GenericCstNode): GenericCstNode | undefined {
  const argumentList = firstChild(creationNode, "argumentList");
  if (!argumentList) {
    return undefined;
  }

  return firstChild(argumentList, "expression");
}

function extractChainedRootIdentifier(expression: GenericCstNode): string | undefined {
  for (const primary of walkDescendants(expression, "primary")) {
    const prefix = firstChild(primary, "primaryPrefix");
    if (!prefix) {
      continue;
    }

    const identifier = getTokenImage(prefix.children?.Identifier?.[0]);
    if (identifier) {
      return identifier;
    }

    for (const part of walkDescendants(prefix, "fqnOrRefTypePartCommon")) {
      const image = getTokenImage(part);
      if (image) {
        return image;
      }
    }
  }

  return undefined;
}

function unwrapVariableInitializer(node: GenericCstNode): GenericCstNode {
  const expression = firstChild(node, "expression");
  return expression ?? node;
}

function findLocalVariableInitializer(body: GenericCstNode | undefined, variableName: string): GenericCstNode | undefined {
  if (!body) {
    return undefined;
  }

  for (const localVariableDeclaration of walkDescendants(body, "localVariableDeclaration")) {
    const variableDeclaratorList = firstChild(localVariableDeclaration, "variableDeclaratorList");
    for (const variableDeclarator of childNodes(variableDeclaratorList, "variableDeclarator")) {
      const variableDeclaratorId = firstChild(variableDeclarator, "variableDeclaratorId");
      const name = getTokenImage(variableDeclaratorId?.children?.Identifier?.[0]);
      if (name !== variableName) {
        continue;
      }

      const initializer = firstChild(variableDeclarator, "variableInitializer");
      if (initializer) {
        return initializer;
      }
    }
  }

  return undefined;
}

function resolveExpressionPath(
  expression: GenericCstNode | undefined,
  body: GenericCstNode | undefined,
  resolvedConstants: ReadonlyMap<string, string>,
  visited: Set<string> = new Set(),
): string | undefined {
  if (!expression) {
    return undefined;
  }

  const builderPath = extractUriComponentsBuilderPath(expression, resolvedConstants);
  if (builderPath) {
    return builderPath;
  }

  const literal = extractStringLiteral(expression);
  if (literal !== undefined) {
    return literal;
  }

  const chainRoot = extractChainedRootIdentifier(expression);
  if (chainRoot && !visited.has(chainRoot)) {
    if (resolvedConstants.has(chainRoot)) {
      return resolvedConstants.get(chainRoot);
    }

    visited.add(chainRoot);
    const chainInitializer = findLocalVariableInitializer(body, chainRoot);
    if (chainInitializer) {
      const path = resolveExpressionPath(
        unwrapVariableInitializer(chainInitializer),
        body,
        resolvedConstants,
        visited,
      );
      if (path) {
        return path;
      }
    }
  }

  const identifier = extractReferenceName(expression);
  if (!identifier || visited.has(identifier)) {
    return undefined;
  }

  if (resolvedConstants.has(identifier)) {
    return resolvedConstants.get(identifier);
  }

  visited.add(identifier);
  const initializer = findLocalVariableInitializer(body, identifier);
  if (!initializer) {
    return undefined;
  }

  return resolveExpressionPath(
    unwrapVariableInitializer(initializer),
    body,
    resolvedConstants,
    visited,
  );
}

function resolveRequestPath(
  argumentExpression: GenericCstNode | undefined,
  body: GenericCstNode | undefined,
  context: ApacheHttpExtractionContext,
): string | undefined {
  return resolveExpressionPath(argumentExpression, body, context.stringConstants);
}

function collectRequestCreations(
  body: GenericCstNode | undefined,
  endpoints: Set<string>,
  context: ApacheHttpExtractionContext,
): void {
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

      const pathLiteral = resolveRequestPath(extractFirstArgumentExpression(creationNode), body, context);
      if (pathLiteral) {
        endpoints.add(formatEndpoint(httpMethod as "GET", pathLiteral));
      }
    }
  }
}

function collectClassicRequestBuilderCalls(
  body: GenericCstNode | undefined,
  endpoints: Set<string>,
  context: ApacheHttpExtractionContext,
): void {
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
        const pathLiteral = resolvePathArgument(firstChild(argumentList, "expression"), context.stringConstants);
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
      const pathLiteral = resolvePathArgument(firstChild(argumentList, "expression"), context.stringConstants);
      if (!pathLiteral) {
        continue;
      }

      endpoints.add(formatEndpoint(methodName.toUpperCase() as "GET", pathLiteral));
    }
  }
}

export function extractApacheHttpEndpoints(
  body: GenericCstNode | undefined,
  context: ApacheHttpExtractionContext = { stringConstants: new Map() },
): string[] {
  const endpoints = new Set<string>();
  collectRequestCreations(body, endpoints, context);
  collectClassicRequestBuilderCalls(body, endpoints, context);
  return [...endpoints].sort();
}

function findApacheHttpMethodInBody(body: GenericCstNode | undefined): string | undefined {
  if (!body) {
    return undefined;
  }

  for (const nodeName of CLASS_INSTANCE_CREATION_NODES) {
    for (const creationNode of walkDescendants(body, nodeName)) {
      const typeName = extractCreatedTypeName(creationNode);
      if (!typeName) {
        continue;
      }

      const httpMethod = httpMethodFromRequestTypeName(typeName);
      if (httpMethod) {
        return httpMethod;
      }
    }
  }

  return undefined;
}

function findPathParameterInBuilder(method: JavaMethodDeclaration): string | undefined {
  if (!method.body) {
    return undefined;
  }

  for (const primary of walkDescendants(method.body, "primary")) {
    const suffixes = childNodes(primary, "primarySuffix");
    let pendingMethodName: string | undefined;

    for (const primarySuffix of suffixes) {
      const suffixName = getSuffixName(primarySuffix);
      const invocationSuffix = firstChild(primarySuffix, "methodInvocationSuffix");
      const args = getInvocationArgumentExpressions(invocationSuffix);

      if (suffixName && args.length === 0 && !invocationSuffix) {
        pendingMethodName = suffixName;
        continue;
      }

      let methodName = suffixName;
      if (!methodName && args.length > 0 && pendingMethodName) {
        methodName = pendingMethodName;
        pendingMethodName = undefined;
      } else if (methodName) {
        pendingMethodName = undefined;
      }

      if (methodName !== "path" || args.length === 0) {
        continue;
      }

      const parameterName = extractReferenceName(args[0]);
      if (parameterName && method.parameters.some((parameter) => parameter.name === parameterName)) {
        return parameterName;
      }
    }
  }

  return undefined;
}

function findMethodCallArgumentIdentifiers(
  body: GenericCstNode | undefined,
  targetMethodName: string,
  argumentIndex: number,
): string[] {
  const identifiers: string[] = [];
  if (!body) {
    return identifiers;
  }

  for (const primary of walkDescendants(body, "primary")) {
    const methodName = getTrailingPrimaryPrefixName(primary);
    if (methodName !== targetMethodName) {
      continue;
    }

    for (const primarySuffix of childNodes(primary, "primarySuffix")) {
      const invocationSuffix = firstChild(primarySuffix, "methodInvocationSuffix");
      const args = getInvocationArgumentExpressions(invocationSuffix);
      if (argumentIndex >= args.length) {
        continue;
      }

      const identifier = extractReferenceName(args[argumentIndex]);
      if (identifier) {
        identifiers.push(identifier);
      }
    }
  }

  return identifiers;
}

function extractHelperMethodEndpointsFromCallSites(
  type: JavaTypeDeclaration,
  method: JavaMethodDeclaration,
  stringConstants: ReadonlyMap<string, string>,
): string[] {
  const pathParameterName = findPathParameterInBuilder(method);
  if (!pathParameterName) {
    return [];
  }

  const httpMethod = findApacheHttpMethodInBody(method.body);
  if (!httpMethod) {
    return [];
  }

  const parameterIndex = method.parameters.findIndex((parameter) => parameter.name === pathParameterName);
  if (parameterIndex === -1) {
    return [];
  }

  const endpoints = new Set<string>();

  for (const callerMethod of type.methods) {
    if (callerMethod === method) {
      continue;
    }

    for (const argumentIdentifier of findMethodCallArgumentIdentifiers(
      callerMethod.body,
      method.name,
      parameterIndex,
    )) {
      const path = stringConstants.get(argumentIdentifier);
      if (path) {
        endpoints.add(formatEndpoint(httpMethod as "GET", path));
      }
    }
  }

  return [...endpoints].sort();
}

function methodReferencesConstant(method: JavaMethodDeclaration, constantName: string): boolean {
  if (!method.body) {
    return false;
  }

  for (const identifier of walkDescendants(method.body, "Identifier")) {
    if (getTokenImage(identifier) === constantName) {
      return true;
    }
  }

  return false;
}

function extractEndpointsFromPathConstantsAndMethods(
  type: JavaTypeDeclaration,
  stringConstants: ReadonlyMap<string, string>,
): string[] {
  const endpoints = new Set<string>();

  for (const method of type.methods) {
    const httpMethod = findApacheHttpMethodInBody(method.body);
    if (!httpMethod) {
      continue;
    }

    for (const [constantName, path] of stringConstants) {
      if (!isPathLikeConstant(path)) {
        continue;
      }

      if (methodReferencesConstant(method, constantName)) {
        endpoints.add(formatEndpoint(httpMethod as "GET", path));
      }
    }
  }

  return [...endpoints].sort();
}

function isRestClientNamingHeuristic(type: JavaTypeDeclaration): boolean {
  const nameLower = type.name.toLowerCase();
  const fqcnLower = type.fqcn.toLowerCase();
  return (
    nameLower.includes("restclient") ||
    fqcnLower.includes(".restclient.") ||
    nameLower.endsWith("restclientimpl")
  );
}

function hasApacheHttpExecutePattern(type: JavaTypeDeclaration): boolean {
  for (const method of type.methods) {
    if (!method.body) {
      continue;
    }

    let hasExecute = false;
    let hasRequestCreation = false;

    collectPrimaryInvocations(method.body, (methodName) => {
      if (methodName === "execute") {
        hasExecute = true;
      }
    });

    for (const nodeName of CLASS_INSTANCE_CREATION_NODES) {
      for (const creationNode of walkDescendants(method.body, nodeName)) {
        const typeName = extractCreatedTypeName(creationNode);
        if (typeName && httpMethodFromRequestTypeName(typeName)) {
          hasRequestCreation = true;
          break;
        }
      }
      if (hasRequestCreation) {
        break;
      }
    }

    if (hasExecute && hasRequestCreation) {
      return true;
    }
  }

  return false;
}

export function extractApacheHttpEndpointsForType(type: JavaTypeDeclaration): string[] {
  const stringConstants = collectTypeStringConstants(type);
  const context: ApacheHttpExtractionContext = { stringConstants };
  const endpoints = new Set<string>();

  for (const method of type.methods) {
    for (const endpoint of extractApacheHttpEndpoints(method.body, context)) {
      endpoints.add(endpoint);
    }

    for (const endpoint of extractHelperMethodEndpointsFromCallSites(type, method, stringConstants)) {
      endpoints.add(endpoint);
    }
  }

  if (endpoints.size === 0) {
    for (const endpoint of extractEndpointsFromPathConstantsAndMethods(type, stringConstants)) {
      endpoints.add(endpoint);
    }
  }

  if (endpoints.size === 0 && isRestClientNamingHeuristic(type) && hasApacheHttpExecutePattern(type)) {
    for (const path of stringConstants.values()) {
      if (isPathLikeConstant(path)) {
        endpoints.add(formatEndpoint("GET", path));
      }
    }
  }

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
  context: ApacheHttpExtractionContext = { stringConstants: new Map() },
): string[] {
  const endpoints = new Set<string>();

  for (const method of methods) {
    for (const endpoint of extractApacheHttpEndpoints(method.body, context)) {
      endpoints.add(endpoint);
    }
  }

  return [...endpoints].sort();
}
