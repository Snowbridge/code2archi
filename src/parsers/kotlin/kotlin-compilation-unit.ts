import type { SyntaxNode } from "tree-sitter";
import type { KotlinCompilationUnit, KotlinMethodDeclaration, KotlinParameter, KotlinTypeDeclaration } from "./kotlin-ast-model.js";
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

function extractMethod(functionNode: SyntaxNode): KotlinMethodDeclaration | undefined {
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

function extractClassBodyMethods(classBody: SyntaxNode | undefined): KotlinMethodDeclaration[] {
  if (!classBody) {
    return [];
  }

  const methods: KotlinMethodDeclaration[] = [];
  for (const declaration of nodeChildren(classBody)) {
    if (declaration.type === "function_declaration") {
      const method = extractMethod(declaration);
      if (method) {
        methods.push(method);
      }
    }
  }

  return methods;
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

  sink.push({
    name: className,
    fqcn: [...outerTypeStack, className].join("$"),
    annotations: extractAnnotations(classNode),
    superClass,
    interfaces,
    methods: extractClassBodyMethods(classBody),
    nestedTypes,
  });
}

export function parseKotlinCompilationUnit(source: string): KotlinCompilationUnit {
  const parser = createKotlinParser();
  const tree = parser.parse(source);
  const root = tree.rootNode;

  const packageName = extractPackageName(root);
  const imports = extractImports(root);
  const types: KotlinTypeDeclaration[] = [];

  for (const child of nodeChildren(root)) {
    if (child.type === "class_declaration") {
      extractClassDeclaration(child, [], types);
    }
  }

  if (packageName) {
    const prefixTypes = (type: KotlinTypeDeclaration): KotlinTypeDeclaration => ({
      ...type,
      fqcn: `${packageName}.${type.fqcn}`,
      nestedTypes: type.nestedTypes.map(prefixTypes),
    });

    return {
      packageName,
      imports,
      types: types.map(prefixTypes),
    };
  }

  return {
    packageName,
    imports,
    types,
  };
}

export function parseKotlinSourceFile(source: string): KotlinCompilationUnit {
  return parseKotlinCompilationUnit(source);
}
