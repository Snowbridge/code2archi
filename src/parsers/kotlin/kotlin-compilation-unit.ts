import type { SyntaxNode } from "tree-sitter";
import type {
  KotlinCompilationUnit,
  KotlinFunctionDeclaration,
  KotlinMethodDeclaration,
  KotlinParameter,
  KotlinPropertyDeclaration,
  KotlinTypeDeclaration,
} from "./kotlin-ast-model.js";
import { extractAnnotations, hasSuspendModifier } from "./kotlin-annotation-utils.js";
import { createKotlinParser } from "./kotlin-tree-sitter.js";
import {
  childByField,
  findChildren,
  findDirectChild,
  findDirectChildren,
  findFirstChild,
  nodeChildren,
  nodeText,
} from "./kotlin-tree-sitter-utils.js";
import { parseTypeRef } from "./kotlin-type-resolver.js";

export interface ParseKotlinOptions {
  readonly fileBaseName?: string;
}

function extractPackageName(root: SyntaxNode): string | undefined {
  const packageHeader = findFirstChild(root, "package_header");
  if (!packageHeader) {
    return undefined;
  }

  const packageIdentifier =
    findFirstChild(packageHeader, "package_identifier") ?? findFirstChild(packageHeader, "identifier");
  if (!packageIdentifier) {
    return undefined;
  }

  return packageIdentifier.text.replace(/\s+/g, "");
}

function extractImports(root: SyntaxNode): Map<string, string> {
  const imports = new Map<string, string>();

  for (const importHeader of findChildren(root, "import_header")) {
    const importIdentifier = findFirstChild(importHeader, "identifier");
    if (!importIdentifier) {
      continue;
    }

    const fqcn = importIdentifier.text.replace(/\s+/g, "");
    const simpleName = fqcn.split(".").at(-1);
    if (simpleName) {
      imports.set(simpleName, fqcn);
    }
  }

  return imports;
}

function extractParameters(functionNode: SyntaxNode): KotlinParameter[] {
  const parameters: KotlinParameter[] = [];
  const parameterList =
    childByField(functionNode, "parameters") ??
    findDirectChild(functionNode, "function_value_parameters") ??
    findDirectChild(functionNode, "primary_constructor");

  if (!parameterList) {
    return parameters;
  }

  for (const parameterNode of nodeChildren(parameterList)) {
    if (parameterNode.type === "parameter_modifiers") {
      continue;
    }

    if (
      parameterNode.type !== "parameter" &&
      parameterNode.type !== "function_value_parameter" &&
      parameterNode.type !== "class_parameter"
    ) {
      continue;
    }

    const typeNode =
      childByField(parameterNode, "type") ?? findFirstChild(parameterNode, "user_type");
    const type = parseTypeRef(typeNode);
    if (!type) {
      continue;
    }

    const nameNode =
      childByField(parameterNode, "name") ?? findDirectChild(parameterNode, "simple_identifier");
    const leadingModifiers = findLeadingParameterModifiers(parameterList, parameterNode);

    parameters.push({
      name: nameNode ? nodeText(nameNode) : undefined,
      type,
      annotations: [...leadingModifiers, ...extractAnnotations(parameterNode)],
    });
  }

  return parameters;
}

function findLeadingParameterModifiers(
  parameterList: SyntaxNode,
  parameterNode: SyntaxNode,
): ReturnType<typeof extractAnnotations> {
  const annotations: ReturnType<typeof extractAnnotations> = [];

  for (const sibling of nodeChildren(parameterList)) {
    if (sibling === parameterNode) {
      break;
    }

    if (sibling.type === "parameter_modifiers") {
      annotations.push(...extractAnnotations(sibling));
    }
  }

  return annotations;
}

function extractFunctionBody(functionNode: SyntaxNode): SyntaxNode | undefined {
  return (
    childByField(functionNode, "body") ??
    findDirectChild(functionNode, "function_body") ??
    findDirectChild(functionNode, "block")
  );
}

function extractReceiverType(functionNode: SyntaxNode): ReturnType<typeof parseTypeRef> {
  const receiverNode =
    childByField(functionNode, "receiver") ??
    findDirectChild(functionNode, "receiver_type") ??
    findFirstChild(functionNode, "user_type");
  if (!receiverNode || receiverNode.parent !== functionNode) {
    const directReceiver = findDirectChild(functionNode, "receiver_type");
    return parseTypeRef(directReceiver);
  }
  return parseTypeRef(receiverNode);
}

function extractMethod(
  functionNode: SyntaxNode,
  options: { isTopLevel: boolean; enclosingTypeFqcn?: string },
): KotlinMethodDeclaration | undefined {
  const nameNode =
    childByField(functionNode, "name") ?? findDirectChild(functionNode, "simple_identifier");
  const name = nameNode ? nodeText(nameNode) : undefined;
  if (!name) {
    return undefined;
  }

  const returnTypeNode =
    childByField(functionNode, "return_type") ??
    findDirectChild(functionNode, "user_type") ??
    findDirectChild(functionNode, "type_reference");

  return {
    name,
    returnType: parseTypeRef(returnTypeNode),
    parameters: extractParameters(functionNode),
    annotations: extractAnnotations(functionNode),
    isSuspend: hasSuspendModifier(functionNode),
    receiverType: extractReceiverType(functionNode),
    body: extractFunctionBody(functionNode),
    ...options,
  };
}

function extractPropertyInitializer(propertyNode: SyntaxNode): SyntaxNode | undefined {
  const explicit =
    findFirstChild(propertyNode, "property_initializer") ??
    findDirectChild(propertyNode, "initializer");
  if (explicit) {
    return explicit;
  }

  for (const child of nodeChildren(propertyNode)) {
    if (child.type === "call_expression") {
      return child;
    }
  }

  return undefined;
}

function extractPropertyName(propertyNode: SyntaxNode): string | undefined {
  const variableDeclaration = findDirectChild(propertyNode, "variable_declaration");
  const target = variableDeclaration ?? propertyNode;
  const nameNode =
    childByField(target, "name") ??
    findDirectChild(target, "simple_identifier") ??
    findFirstChild(target, "simple_identifier");
  return nameNode ? nodeText(nameNode) : undefined;
}

function extractPropertyType(propertyNode: SyntaxNode): ReturnType<typeof parseTypeRef> {
  const variableDeclaration = findDirectChild(propertyNode, "variable_declaration");
  const typeNode =
    childByField(propertyNode, "type") ??
    (variableDeclaration ? childByField(variableDeclaration, "type") : undefined) ??
    findFirstChild(propertyNode, "user_type") ??
    (variableDeclaration ? findFirstChild(variableDeclaration, "user_type") : undefined);
  return parseTypeRef(typeNode);
}

function extractProperty(propertyNode: SyntaxNode): KotlinPropertyDeclaration | undefined {
  const name = extractPropertyName(propertyNode);
  if (!name) {
    return undefined;
  }

  return {
    name,
    type: extractPropertyType(propertyNode),
    annotations: extractAnnotations(propertyNode),
    initializer: extractPropertyInitializer(propertyNode),
  };
}

function extractSuperTypes(classNode: SyntaxNode): {
  superClass?: ReturnType<typeof parseTypeRef>;
  interfaces: NonNullable<ReturnType<typeof parseTypeRef>>[];
} {
  const interfaces: NonNullable<ReturnType<typeof parseTypeRef>>[] = [];
  let superClass: ReturnType<typeof parseTypeRef>;

  const delegationContainer = findDirectChild(classNode, "delegation_specifiers");
  const specifiers = delegationContainer
    ? nodeChildren(delegationContainer).filter((node) => node.type === "delegation_specifier")
    : findDirectChildren(classNode, "delegation_specifier");

  for (const specifier of specifiers) {
    if (findFirstChild(specifier, "constructor_invocation")) {
      const userType =
        findFirstChild(specifier, "user_type") ?? findFirstChild(specifier, "type_reference");
      const parsed = parseTypeRef(userType);
      if (parsed) {
        superClass = parsed;
      }
      continue;
    }

    if (findFirstChild(specifier, "explicit_delegation")) {
      continue;
    }

    const userType =
      findFirstChild(specifier, "user_type") ?? findFirstChild(specifier, "type_reference");
    const parsed = parseTypeRef(userType);
    if (parsed) {
      interfaces.push(parsed);
    }
  }

  return { superClass, interfaces };
}

function extractClassBodyMembers(
  classBody: SyntaxNode | undefined,
  enclosingTypeFqcn: string,
): {
  methods: KotlinMethodDeclaration[];
  properties: KotlinPropertyDeclaration[];
} {
  const methods: KotlinMethodDeclaration[] = [];
  const properties: KotlinPropertyDeclaration[] = [];

  if (!classBody) {
    return { methods, properties };
  }

  for (const declaration of nodeChildren(classBody)) {
    if (declaration.type === "function_declaration") {
      const method = extractMethod(declaration, { isTopLevel: false, enclosingTypeFqcn });
      if (method) {
        methods.push(method);
      }
      continue;
    }

    if (declaration.type === "property_declaration") {
      const property = extractProperty(declaration);
      if (property) {
        properties.push(property);
      }
    }
  }

  return { methods, properties };
}

function extractClassDeclaration(
  classNode: SyntaxNode,
  outerTypeStack: readonly string[],
  sink: KotlinTypeDeclaration[],
): void {
  const nameNode = childByField(classNode, "name") ?? findDirectChild(classNode, "type_identifier");
  const className = nameNode ? nodeText(nameNode) : undefined;
  if (!className) {
    return;
  }

  const fqcn = [...outerTypeStack, className].join("$");
  const nestedStart = sink.length;
  const classBody = childByField(classNode, "body") ?? findDirectChild(classNode, "class_body");
  if (classBody) {
    for (const nested of nodeChildren(classBody)) {
      if (nested.type === "class_declaration") {
        extractClassDeclaration(nested, [...outerTypeStack, className], sink);
      }
    }
  }

  const nestedTypes = sink.splice(nestedStart);
  const { superClass, interfaces } = extractSuperTypes(classNode);
  const { methods, properties } = extractClassBodyMembers(classBody, fqcn);

  sink.push({
    name: className,
    fqcn,
    annotations: extractAnnotations(classNode),
    superClass,
    interfaces,
    methods,
    properties,
    nestedTypes,
  });
}

function prefixTypes(
  packageName: string,
  type: KotlinTypeDeclaration,
): KotlinTypeDeclaration {
  return {
    ...type,
    fqcn: `${packageName}.${type.fqcn}`,
    nestedTypes: type.nestedTypes.map((nested) => prefixTypes(packageName, nested)),
    methods: type.methods.map((method) => ({
      ...method,
      enclosingTypeFqcn: `${packageName}.${type.fqcn}`,
    })),
  };
}

export function parseKotlinCompilationUnit(
  source: string,
  options: ParseKotlinOptions = {},
): KotlinCompilationUnit {
  const parser = createKotlinParser();
  const tree = parser.parse(source);
  const root = tree.rootNode;

  const packageName = extractPackageName(root);
  const imports = extractImports(root);
  const fileBaseName = options.fileBaseName ?? "Module";
  const types: KotlinTypeDeclaration[] = [];
  const topLevelFunctions: KotlinFunctionDeclaration[] = [];
  const topLevelProperties: KotlinPropertyDeclaration[] = [];

  for (const child of nodeChildren(root)) {
    if (child.type === "class_declaration") {
      extractClassDeclaration(child, [], types);
      continue;
    }

    if (child.type === "function_declaration") {
      const fn = extractMethod(child, { isTopLevel: true });
      if (fn) {
        topLevelFunctions.push({ ...fn, isTopLevel: true });
      }
      continue;
    }

    if (child.type === "property_declaration") {
      const property = extractProperty(child);
      if (property) {
        topLevelProperties.push(property);
      }
    }
  }

  if (packageName) {
    return {
      packageName,
      imports,
      fileBaseName,
      types: types.map((type) => prefixTypes(packageName, type)),
      topLevelFunctions,
      topLevelProperties,
    };
  }

  return {
    packageName,
    imports,
    fileBaseName,
    types,
    topLevelFunctions,
    topLevelProperties,
  };
}

export function parseKotlinSourceFile(
  source: string,
  options: ParseKotlinOptions = {},
): KotlinCompilationUnit {
  return parseKotlinCompilationUnit(source, options);
}
