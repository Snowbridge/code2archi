import { readFileSync } from "node:fs";
import type { SyntaxNode } from "tree-sitter";
import type { ApplicationModuleRecord } from "../../../../code-inventory/entities/application-module.js";
import type { RepositoryRecord } from "../../../../code-inventory/entities/repository.js";
import { RestClient } from "../../../../code-inventory/entities/rest-client.js";
import {
  annotationMatches,
  resolveTypeName,
  tryExtractJvmFileModel,
} from "../../../../parsers/jvm/extract-jvm-file.js";
import { parseJvmSource } from "../../../../parsers/jvm/jvm-parser.js";
import type { JvmImportContext, JavaKotlinImport } from "../../../../parsers/type-resolution/types.js";
import { parseJavaImports, parseJavaPackage } from "../../../../parsers/type-resolution/parse-java-imports.js";
import { parseKotlinImports, parseKotlinPackage } from "../../../../parsers/type-resolution/parse-kotlin-imports.js";
import type { JvmMethodModel, JvmTypeModel } from "../../../../parsers/jvm/types.js";
import { RestDiscoveryIntentBuilder } from "../intent-builder.js";
import { listProductionJvmSources } from "../list-module-sources.js";
import { moduleProductionRoot } from "../module-binding.js";
import { productionSourceRelativePath } from "../source-scope.js";
import { getLogger } from "../../../../platform/logging/index.js";

const logger = getLogger("scan.extract.rest.clients");

const BEAN_ANNOTATION = "Bean";
const FEIGN_CLIENT_BUILDER_FQCN = "org.springframework.cloud.openfeign.FeignClientBuilder";
const FEIGN_FQCN = "feign.Feign";

interface MethodParameterBinding {
  readonly name: string;
  readonly typeText: string;
}

export function discoverFeignProgrammaticBeansForModule(
  repository: RepositoryRecord,
  module: ApplicationModuleRecord,
): RestDiscoveryIntentBuilder {
  const builder = new RestDiscoveryIntentBuilder();
  const productionRoot = moduleProductionRoot(repository.localPath, module);
  const sourceFiles = listProductionJvmSources(productionRoot);
  const moduleTypeIndex = buildModuleTypeIndex(sourceFiles);

  for (const absolutePath of sourceFiles) {
    const fileName = productionSourceRelativePath(absolutePath, repository.localPath);
    const language = absolutePath.endsWith(".java") ? "java" : "kotlin";
    const source = readFileSync(absolutePath, "utf8");
    const fileModel = tryExtractJvmFileModel(source, language);
    if (fileModel === undefined) {
      logger.warn("skipped JVM source file: tree-sitter parse failed", {
        fileName,
        language,
      });
      continue;
    }
    const importContext = buildImportContext(source, language);

    for (const type of fileModel.types) {
      for (const method of type.methods) {
        if (!isBeanFactoryMethod(method)) {
          continue;
        }
        const methodNode = findMethodDeclarationNode(source, language, type.simpleName, method.name);
        if (methodNode === undefined) {
          continue;
        }
        const parameters = extractMethodParameters(methodNode, language);
        const returnExpression = resolveReturnExpressionRoot(methodNode, language);
        if (returnExpression === undefined) {
          continue;
        }
        const contractFqcn = resolveContractFromExpression(
          returnExpression,
          importContext,
          language,
          parameters,
        );
        if (contractFqcn === undefined) {
          continue;
        }
        const clientFqcn = resolveClientFqcn(
          method.returnType,
          importContext,
          language,
          moduleTypeIndex,
        );
        if (clientFqcn === undefined) {
          logger.warn("feign programmatic bean: unresolvable client return type", {
            fileName,
            method: method.name,
          });
          continue;
        }
        const client = new RestClient({
          applicationModuleId: module.id,
          fqcn: clientFqcn,
          simpleName: simpleNameFromFqcn(clientFqcn),
          fileName,
          endpoints: [],
          dataTypeIds: [],
          origin: "source",
        });
        builder.registerClient(client.toCreateIntent());
        const contractId = builder.registerContract(contractFqcn);
        builder.registerExtractAssignment(contractId, client.id);
      }
    }
  }

  return builder;
}

function isBeanFactoryMethod(method: JvmMethodModel): boolean {
  return method.annotations.some((annotation) => annotationMatches(annotation, BEAN_ANNOTATION));
}

function buildModuleTypeIndex(sourceFiles: readonly string[]): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const absolutePath of sourceFiles) {
    const language = absolutePath.endsWith(".java") ? "java" : "kotlin";
    const source = readFileSync(absolutePath, "utf8");
    const fileModel = tryExtractJvmFileModel(source, language);
    if (fileModel === undefined) {
      continue;
    }
    for (const type of fileModel.types) {
      index.set(type.simpleName, type.fqcn);
    }
  }
  return index;
}

function buildImportContext(source: string, language: "java" | "kotlin"): JvmImportContext {
  const packageName =
    language === "java" ? parseJavaPackage(source) : parseKotlinPackage(source);
  const imports: readonly JavaKotlinImport[] =
    language === "java" ? parseJavaImports(source) : parseKotlinImports(source);
  return { packageName, imports };
}

function resolveClientFqcn(
  returnTypeText: string,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
  moduleTypeIndex: ReadonlyMap<string, string>,
): string | undefined {
  const stripped = stripGenerics(returnTypeText).trim();
  if (stripped.length === 0 || stripped === "void" || stripped === "Unit") {
    return undefined;
  }
  const simple = simpleNameFromTypeText(stripped);
  const fromModule = moduleTypeIndex.get(simple);
  if (fromModule !== undefined) {
    return fromModule;
  }
  try {
    return resolveTypeName(stripped, importContext, language);
  } catch {
    return undefined;
  }
}

function simpleNameFromFqcn(fqcn: string): string {
  const lastDot = fqcn.lastIndexOf(".");
  return lastDot >= 0 ? fqcn.slice(lastDot + 1) : fqcn;
}

function simpleNameFromTypeText(typeText: string): string {
  const stripped = stripGenerics(typeText);
  const lastDot = stripped.lastIndexOf(".");
  return lastDot >= 0 ? stripped.slice(lastDot + 1) : stripped;
}

function stripGenerics(typeText: string): string {
  const genericStart = typeText.indexOf("<");
  return genericStart >= 0 ? typeText.slice(0, genericStart) : typeText;
}

function findMethodDeclarationNode(
  source: string,
  language: "java" | "kotlin",
  classSimpleName: string,
  methodName: string,
): SyntaxNode | undefined {
  const tree = parseJvmSource(source, language);
  const classNode = findClassNode(tree.rootNode, language, classSimpleName);
  if (classNode === undefined) {
    return undefined;
  }
  const body = getClassBodyNode(classNode, language);
  if (body === undefined || body === null) {
    return undefined;
  }
  for (const child of body.children) {
    if (language === "java" && child.type === "method_declaration") {
      const nameNode = child.childForFieldName("name");
      if (nameNode?.text === methodName) {
        return child;
      }
      continue;
    }
    if (language === "kotlin" && child.type === "function_declaration") {
      const nameNode = child.childForFieldName("name") ?? findKotlinFunctionName(child);
      if (nameNode?.text === methodName) {
        return child;
      }
    }
  }
  return undefined;
}

function findClassNode(
  node: SyntaxNode,
  language: "java" | "kotlin",
  simpleName: string,
): SyntaxNode | undefined {
  const classTypes =
    language === "java"
      ? ["class_declaration", "interface_declaration"]
      : ["class_declaration"];
  if (classTypes.includes(node.type)) {
    const nameNode =
      node.childForFieldName("name") ??
      (language === "kotlin"
        ? node.children.find((child) => child.type === "type_identifier")
        : undefined);
    if (nameNode?.text === simpleName) {
      return node;
    }
  }
  for (const child of node.children) {
    const found = findClassNode(child, language, simpleName);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

function getClassBodyNode(
  classNode: SyntaxNode,
  language: "java" | "kotlin",
): SyntaxNode | null | undefined {
  if (language === "kotlin") {
    return (
      classNode.childForFieldName("body") ??
      classNode.children.find((child) => child.type === "class_body") ??
      null
    );
  }
  return classNode.childForFieldName("body");
}

function extractMethodParameters(
  methodNode: SyntaxNode,
  language: "java" | "kotlin",
): readonly MethodParameterBinding[] {
  const parameters: MethodParameterBinding[] = [];
  const paramsNode =
    methodNode.childForFieldName("parameters") ??
    methodNode.children.find(
      (child) => child.type === "formal_parameters" || child.type === "function_value_parameters",
    );
  if (paramsNode === undefined || paramsNode === null) {
    return parameters;
  }
  for (const child of paramsNode.children) {
    if (
      language === "java" &&
      child.type !== "formal_parameter" &&
      child.type !== "receiver_parameter"
    ) {
      continue;
    }
    if (
      language === "kotlin" &&
      child.type !== "parameter" &&
      child.type !== "required_parameter" &&
      child.type !== "class_parameter"
    ) {
      continue;
    }
    const nameNode = child.childForFieldName("name");
    const typeNode = child.childForFieldName("type") ?? findTypeChild(child);
    if (nameNode === null || nameNode === undefined || typeNode === undefined) {
      continue;
    }
    parameters.push({ name: nameNode.text, typeText: typeNode.text });
  }
  return parameters;
}

function findTypeChild(node: SyntaxNode): SyntaxNode | undefined {
  for (const child of node.children) {
    if (
      child.type === "type_identifier" ||
      child.type === "user_type" ||
      child.type === "generic_type" ||
      child.type === "nullable_type"
    ) {
      return child;
    }
  }
  return undefined;
}

function findKotlinFunctionName(functionNode: SyntaxNode): SyntaxNode | undefined {
  for (const child of functionNode.children) {
    if (child.type === "simple_identifier") {
      return child;
    }
  }
  return undefined;
}

function resolveReturnExpressionRoot(
  methodNode: SyntaxNode,
  language: "java" | "kotlin",
): SyntaxNode | undefined {
  if (language === "kotlin") {
    const body =
      methodNode.childForFieldName("body") ??
      methodNode.children.find((child) => child.type === "function_body");
    if (body !== undefined && body.type === "function_body") {
      const returnExpr = findKotlinReturnExpression(body);
      if (returnExpr !== undefined) {
        return returnExpr;
      }
      for (const child of body.children) {
        if (child.type === "call_expression" || child.type === "navigation_expression") {
          return child;
        }
      }
    }
  }

  const body = methodNode.childForFieldName("body");
  if (body === null || body === undefined) {
    return undefined;
  }
  const directReturn = findJavaReturnExpression(body);
  if (directReturn !== undefined) {
    if (directReturn.type === "identifier") {
      const fromLocal = findJavaLocalVariableInitializer(body, directReturn.text);
      if (fromLocal !== undefined) {
        return fromLocal;
      }
    }
    return directReturn;
  }
  return resolveJavaLocalVariableReturn(body);
}

function findJavaLocalVariableInitializer(body: SyntaxNode, variableName: string): SyntaxNode | undefined {
  let found: SyntaxNode | undefined;
  const visit = (node: SyntaxNode): void => {
    if (node.type === "local_variable_declaration") {
      for (const child of node.children) {
        if (child.type !== "variable_declarator") {
          continue;
        }
        const nameNode = child.childForFieldName("name");
        if (nameNode?.text !== variableName) {
          continue;
        }
        let valueNode = child.childForFieldName("value");
        if (valueNode === null || valueNode === undefined) {
          for (let index = 0; index < child.namedChildCount; index += 1) {
            const named = child.namedChild(index);
            if (
              named !== null &&
              named.type !== "identifier" &&
              named.type !== "type_identifier"
            ) {
              valueNode = named;
              break;
            }
          }
        }
        if (valueNode !== null && valueNode !== undefined) {
          found = valueNode;
        }
      }
    }
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(body);
  return found;
}

function findJavaReturnExpression(body: SyntaxNode): SyntaxNode | undefined {
  for (const child of body.children) {
    if (child.type === "return_statement") {
      const fromField = child.childForFieldName("value");
      if (fromField !== null && fromField !== undefined) {
        return fromField;
      }
      for (let index = 0; index < child.namedChildCount; index += 1) {
        const named = child.namedChild(index);
        if (named !== null && named.type !== "return") {
          return named;
        }
      }
      return undefined;
    }
    if (child.type === "block") {
      const nested = findJavaReturnExpression(child);
      if (nested !== undefined) {
        return nested;
      }
    }
  }
  return undefined;
}

function findKotlinReturnExpression(body: SyntaxNode): SyntaxNode | undefined {
  for (const child of body.children) {
    if (child.type === "return_expression") {
      return child.childForFieldName("expression") ?? child.children.find((c) => c.type !== "return") ?? undefined;
    }
    if (child.type === "statements" || child.type === "block") {
      const nested = findKotlinReturnExpression(child);
      if (nested !== undefined) {
        return nested;
      }
    }
  }
  return undefined;
}

function resolveJavaLocalVariableReturn(body: SyntaxNode): SyntaxNode | undefined {
  const declarations = new Map<string, SyntaxNode>();
  let returnIdentifier: string | undefined;

  const visit = (node: SyntaxNode): void => {
    if (node.type === "local_variable_declaration") {
      for (const child of node.children) {
        if (child.type === "variable_declarator") {
          const nameNode = child.childForFieldName("name");
          let valueNode = child.childForFieldName("value");
          if (valueNode === null || valueNode === undefined) {
            for (let index = 0; index < child.namedChildCount; index += 1) {
              const named = child.namedChild(index);
              if (
                named !== null &&
                named.type !== "identifier" &&
                named.type !== "type_identifier"
              ) {
                valueNode = named;
                break;
              }
            }
          }
          if (
            nameNode !== null &&
            nameNode !== undefined &&
            valueNode !== null &&
            valueNode !== undefined
          ) {
            declarations.set(nameNode.text, valueNode);
          }
        }
      }
      return;
    }
    if (node.type === "return_statement") {
      const value =
        node.childForFieldName("value") ??
        [...Array(node.namedChildCount)].map((_, index) => node.namedChild(index)).find(
          (named) => named !== null && named.type !== "return",
        );
      if (value?.type === "identifier") {
        returnIdentifier = value.text;
      }
      return;
    }
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(body);

  if (returnIdentifier === undefined) {
    return undefined;
  }
  return declarations.get(returnIdentifier);
}

function resolveContractFromExpression(
  expression: SyntaxNode,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
  parameters: readonly MethodParameterBinding[],
): string | undefined {
  const pathA = tryPathFeignClientBuilder(expression, importContext, language, parameters);
  if (pathA !== undefined) {
    return pathA;
  }
  return tryPathRawFeign(expression, importContext, language);
}

function tryPathFeignClientBuilder(
  expression: SyntaxNode,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
  parameters: readonly MethodParameterBinding[],
): string | undefined {
  const chain = collectInvocationChain(expression, language);
  const forType = chain.find((item) => item.methodName === "forType");
  const build = chain.find((item) => item.methodName === "build");
  if (forType === undefined || build === undefined) {
    return undefined;
  }
  if (!invocationReceiverIsFeignClientBuilder(forType.receiver, importContext, language, parameters)) {
    return undefined;
  }
  const firstArg = forType.arguments[0];
  if (firstArg === undefined) {
    return undefined;
  }
  return resolveClassTypeReference(firstArg, importContext, language);
}

function tryPathRawFeign(
  expression: SyntaxNode,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): string | undefined {
  const chain = collectInvocationChain(expression, language);
  const target = chain.find((item) => item.methodName === "target");
  const builder = chain.find((item) => item.methodName === "builder");
  if (target === undefined || builder === undefined) {
    return undefined;
  }
  if (!invocationReceiverIsFeign(builder.receiver, importContext, language)) {
    return undefined;
  }
  const firstArg = target.arguments[0];
  if (firstArg === undefined) {
    return undefined;
  }
  return resolveClassTypeReference(firstArg, importContext, language);
}

interface InvocationChainItem {
  readonly methodName: string;
  readonly receiver: SyntaxNode | undefined;
  readonly arguments: readonly SyntaxNode[];
}

function collectInvocationChain(
  expression: SyntaxNode,
  language: "java" | "kotlin",
): InvocationChainItem[] {
  const chain: InvocationChainItem[] = [];
  let current: SyntaxNode | undefined = expression;
  while (current !== undefined) {
    const parsed = parseInvocation(current, language);
    if (parsed === undefined) {
      break;
    }
    chain.push(parsed);
    current = parsed.receiver;
  }
  return chain;
}

function parseInvocation(
  node: SyntaxNode,
  language: "java" | "kotlin",
): InvocationChainItem | undefined {
  if (language === "java" && node.type === "method_invocation") {
    const nameNode = node.childForFieldName("name");
    const objectNode = node.childForFieldName("object") ?? undefined;
    const argsNode = node.childForFieldName("arguments");
    const args = collectArgumentNodes(argsNode);
    if (nameNode === null || nameNode === undefined) {
      return undefined;
    }
    return { methodName: nameNode.text, receiver: objectNode, arguments: args };
  }
  if (language === "kotlin" && node.type === "call_expression") {
    const functionNode =
      node.childForFieldName("function") ??
      node.children.find(
        (child) =>
          child.type === "navigation_expression" ||
          child.type === "simple_identifier" ||
          child.type === "call_expression",
      );
    if (functionNode === undefined) {
      return undefined;
    }
    const callSuffix = node.children.find((child) => child.type === "call_suffix");
    const args = collectKotlinCallArguments(callSuffix);
    if (functionNode.type === "simple_identifier") {
      return { methodName: functionNode.text, receiver: undefined, arguments: args };
    }
    if (functionNode.type === "navigation_expression") {
      const methodName = kotlinNavigationMethodName(functionNode);
      if (methodName === undefined) {
        return undefined;
      }
      const receiver = kotlinNavigationReceiver(functionNode);
      return { methodName, receiver, arguments: args };
    }
    if (functionNode.type === "call_expression") {
      const inner = parseInvocation(functionNode, language);
      if (inner === undefined) {
        return undefined;
      }
      return { ...inner, arguments: args.length > 0 ? args : inner.arguments };
    }
  }
  return undefined;
}

function kotlinNavigationMethodName(navigationExpression: SyntaxNode): string | undefined {
  const suffixes = navigationExpression.children.filter((child) => child.type === "navigation_suffix");
  const lastSuffix = suffixes[suffixes.length - 1];
  return lastSuffix?.children.find((child) => child.type === "simple_identifier")?.text;
}

function kotlinNavigationReceiver(navigationExpression: SyntaxNode): SyntaxNode | undefined {
  const nestedCall = navigationExpression.children.find((child) => child.type === "call_expression");
  if (nestedCall !== undefined) {
    return nestedCall;
  }
  return (
    navigationExpression.childForFieldName("expression") ??
    navigationExpression.children.find((child) => child.type === "simple_identifier")
  );
}

function collectKotlinCallArguments(callSuffix: SyntaxNode | undefined): SyntaxNode[] {
  if (callSuffix === undefined) {
    return [];
  }
  const valueArguments = callSuffix.children.find((child) => child.type === "value_arguments");
  return collectArgumentNodes(valueArguments);
}

function collectArgumentNodes(argsNode: SyntaxNode | null | undefined): SyntaxNode[] {
  if (argsNode === null || argsNode === undefined) {
    return [];
  }
  const args: SyntaxNode[] = [];
  for (const child of argsNode.children) {
    if (
      child.type === "argument" ||
      child.type === "value_argument" ||
      child.type === "expression"
    ) {
      const value =
        child.childForFieldName("value") ??
        child.children.find((c) => c.type !== "," && c.type !== "(" && c.type !== ")");
      if (value !== undefined) {
        args.push(value);
        continue;
      }
    }
    if (child.type !== "," && child.type !== "(" && child.type !== ")") {
      args.push(child);
    }
  }
  return args;
}

function invocationReceiverIsFeignClientBuilder(
  receiver: SyntaxNode | undefined,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
  parameters: readonly MethodParameterBinding[],
): boolean {
  const fqcn = resolveExpressionTypeFqcn(receiver, importContext, language, parameters);
  return fqcn === FEIGN_CLIENT_BUILDER_FQCN;
}

function invocationReceiverIsFeign(
  receiver: SyntaxNode | undefined,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): boolean {
  const fqcn = resolveExpressionTypeFqcn(receiver, importContext, language, []);
  return fqcn === FEIGN_FQCN;
}

function resolveExpressionTypeFqcn(
  receiver: SyntaxNode | undefined,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
  parameters: readonly MethodParameterBinding[],
): string | undefined {
  if (receiver === undefined) {
    return undefined;
  }
  if (receiver.type === "identifier" || receiver.type === "simple_identifier") {
    const param = parameters.find((item) => item.name === receiver.text);
    if (param !== undefined) {
      return resolveTypeName(stripGenerics(param.typeText), importContext, language);
    }
    return resolveTypeName(receiver.text, importContext, language);
  }
  if (
    receiver.type === "type_identifier" ||
    receiver.type === "scoped_identifier" ||
    receiver.type === "simple_identifier"
  ) {
    return resolveTypeName(receiver.text, importContext, language);
  }
  if (receiver.type === "navigation_expression") {
    const nameNode = receiver.childForFieldName("name");
    const expr = receiver.childForFieldName("expression");
    if (nameNode?.text === "builder" && expr !== null && expr !== undefined) {
      return resolveExpressionTypeFqcn(expr, importContext, language, parameters);
    }
  }
  if (receiver.type === "field_access") {
    const objectNode = receiver.childForFieldName("object");
    const fieldNode = receiver.childForFieldName("field");
    if (fieldNode?.text === "class" && objectNode !== null && objectNode !== undefined) {
      return resolveTypeName(objectNode.text, importContext, language);
    }
    if (objectNode !== null && objectNode !== undefined) {
      const objectFqcn = resolveExpressionTypeFqcn(objectNode, importContext, language, parameters);
      if (objectFqcn === FEIGN_FQCN && fieldNode?.text === "builder") {
        return FEIGN_FQCN;
      }
    }
    if (objectNode?.type === "identifier" || objectNode?.type === "type_identifier") {
      return resolveTypeName(objectNode.text, importContext, language);
    }
  }
  return undefined;
}

function resolveClassTypeReference(
  node: SyntaxNode,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): string | undefined {
  if (node.type === "field_access") {
    const objectNode = node.childForFieldName("object");
    const fieldNode = node.childForFieldName("field");
    if (fieldNode?.text === "class" && objectNode !== null && objectNode !== undefined) {
      return resolveTypeName(typeTextFromNode(objectNode), importContext, language);
    }
    if (fieldNode?.text === "java" && objectNode?.type === "class_literal") {
      const inner = objectNode.childForFieldName("type");
      if (inner !== null && inner !== undefined) {
        return resolveTypeName(typeTextFromNode(inner), importContext, language);
      }
    }
  }
  if (node.type === "class_literal") {
    const typeNode =
      node.childForFieldName("type") ??
      node.children.find(
        (child) =>
          child.type === "type_identifier" ||
          child.type === "scoped_type_identifier" ||
          child.type === "user_type",
      );
    if (typeNode !== undefined) {
      return resolveTypeName(typeTextFromNode(typeNode), importContext, language);
    }
  }
  if (node.type === "type_identifier" || node.type === "user_type") {
    return resolveTypeName(typeTextFromNode(node), importContext, language);
  }
  if (node.type === "callable_reference") {
    const typeNode = node.children.find(
      (child) => child.type === "user_type" || child.type === "type_identifier",
    );
    if (typeNode !== undefined) {
      return resolveTypeName(typeTextFromNode(typeNode), importContext, language);
    }
  }
  if (node.type === "navigation_expression") {
    const callable = node.children.find((child) => child.type === "callable_reference");
    if (callable !== undefined) {
      return resolveClassTypeReference(callable, importContext, language);
    }
  }
  logger.warn("feign programmatic bean: unresolvable contract type argument", {
    snippet: node.text.slice(0, 80),
  });
  return undefined;
}

function typeTextFromNode(node: SyntaxNode): string {
  if (node.type === "user_type") {
    const id = node.children.find((child) => child.type === "type_identifier");
    return id?.text ?? node.text;
  }
  return node.text.replace(/::class\.java$/, "").replace(/::class$/, "");
}
