import type { SyntaxNode } from "tree-sitter";
import type { JavaKotlinImport, JvmImportContext } from "../type-resolution/types.js";
import { parseJavaImports, parseJavaPackage } from "../type-resolution/parse-java-imports.js";
import { parseKotlinImports, parseKotlinPackage } from "../type-resolution/parse-kotlin-imports.js";
import { resolveJavaFqcn } from "../type-resolution/resolve-java-fqcn.js";
import { resolveKotlinFqcn } from "../type-resolution/resolve-kotlin-fqcn.js";
import { parseJvmSource } from "./jvm-parser.js";
import type { JvmAnnotation, JvmFileModel, JvmMethodModel, JvmTypeModel } from "./types.js";

export function extractJvmFileModel(
  source: string,
  language: "java" | "kotlin",
): JvmFileModel {
  const tree = parseJvmSource(source, language);
  const packageName =
    language === "java" ? parseJavaPackage(source) : parseKotlinPackage(source);
  const imports =
    language === "java" ? parseJavaImports(source) : parseKotlinImports(source);
  const importContext: JvmImportContext = { packageName, imports };

  const types: JvmTypeModel[] = [];
  for (const child of tree.rootNode.children) {
    if (
      child.type === "class_declaration" ||
      child.type === "interface_declaration" ||
      child.type === "class_declaration" ||
      child.type === "class_declaration"
    ) {
      const typeModel = extractJavaType(child, packageName, importContext, language);
      if (typeModel !== undefined) {
        types.push(typeModel);
      }
      continue;
    }
    if (child.type === "class_declaration" || child.type === "object_declaration") {
      const typeModel = extractKotlinType(child, packageName, importContext);
      if (typeModel !== undefined) {
        types.push(typeModel);
      }
    }
  }

  // Kotlin uses class_declaration at top level
  if (language === "kotlin" && types.length === 0) {
    walkKotlinTypes(tree.rootNode, packageName, importContext, types);
  }

  if (language === "java" && types.length === 0) {
    walkJavaTypes(tree.rootNode, packageName, importContext, types);
  }

  return { packageName, types };
}

export function tryExtractJvmFileModel(
  source: string,
  language: "java" | "kotlin",
): JvmFileModel | undefined {
  try {
    return extractJvmFileModel(source, language);
  } catch {
    return undefined;
  }
}

function walkJavaTypes(
  node: SyntaxNode,
  packageName: string,
  importContext: JvmImportContext,
  types: JvmTypeModel[],
): void {
  if (node.type === "class_declaration" || node.type === "interface_declaration") {
    const typeModel = extractJavaType(node, packageName, importContext, "java");
    if (typeModel !== undefined) {
      types.push(typeModel);
    }
  }
  for (const child of node.children) {
    walkJavaTypes(child, packageName, importContext, types);
  }
}

function walkKotlinTypes(
  node: SyntaxNode,
  packageName: string,
  importContext: JvmImportContext,
  types: JvmTypeModel[],
): void {
  if (node.type === "class_declaration") {
    const typeModel = extractKotlinType(node, packageName, importContext);
    if (typeModel !== undefined) {
      types.push(typeModel);
    }
  }
  for (const child of node.children) {
    walkKotlinTypes(child, packageName, importContext, types);
  }
}

function extractJavaType(
  node: SyntaxNode,
  packageName: string,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): JvmTypeModel | undefined {
  const nameNode = node.childForFieldName("name");
  if (!nameNode) {
    return undefined;
  }
  const simpleName = nameNode.text;
  const fqcn = packageName.length > 0 ? `${packageName}.${simpleName}` : simpleName;
  const annotations = extractAnnotations(node);
  const implementedInterfaces = extractJavaInterfaces(node);
  const methods = extractJavaMethods(node);
  return {
    simpleName,
    fqcn,
    annotations,
    implementedInterfaces,
    methods,
  };
}

function extractKotlinType(
  node: SyntaxNode,
  packageName: string,
  importContext: JvmImportContext,
): JvmTypeModel | undefined {
  const nameNode = node.childForFieldName("name") ?? findChildTypeIdentifier(node);
  if (!nameNode) {
    return undefined;
  }
  const simpleName = nameNode.text;
  const fqcn = packageName.length > 0 ? `${packageName}.${simpleName}` : simpleName;
  return {
    simpleName,
    fqcn,
    annotations: extractAnnotations(node),
    implementedInterfaces: extractKotlinInterfaces(node),
    methods: extractKotlinMethods(node),
  };
}

function findChildTypeIdentifier(node: SyntaxNode): SyntaxNode | null {
  for (const child of node.children) {
    if (child.type === "type_identifier" || child.type === "simple_identifier") {
      return child;
    }
  }
  return null;
}

function extractJavaInterfaces(node: SyntaxNode): string[] {
  const interfaces: string[] = [];
  const superInterfaces = node.childForFieldName("interfaces");
  if (superInterfaces) {
    collectTypeIdentifiers(superInterfaces, interfaces);
  }
  return interfaces;
}

function extractKotlinInterfaces(node: SyntaxNode): string[] {
  const interfaces: string[] = [];
  for (const child of node.children) {
    if (child.type === "delegation_specifier" || child.type === "delegation_specifiers") {
      collectTypeIdentifiers(child, interfaces);
    }
  }
  return interfaces;
}

function collectTypeIdentifiers(node: SyntaxNode, output: string[]): void {
  if (
    node.type === "type_identifier" ||
    node.type === "simple_identifier" ||
    node.type === "user_type"
  ) {
    const text = node.type === "user_type"
      ? node.children.find((child) => child.type === "type_identifier")?.text ?? node.text
      : node.text;
    if (text.length > 0) {
      output.push(text);
    }
  }
  for (const child of node.children) {
    collectTypeIdentifiers(child, output);
  }
}

function extractJavaMethods(node: SyntaxNode): JvmMethodModel[] {
  const methods: JvmMethodModel[] = [];
  const body = node.childForFieldName("body");
  if (!body) {
    return methods;
  }
  for (const child of body.children) {
    if (child.type !== "method_declaration" && child.type !== "constructor_declaration") {
      continue;
    }
    if (child.type === "constructor_declaration") {
      continue;
    }
    const method = extractJavaMethod(child);
    if (method !== undefined) {
      methods.push(method);
    }
  }
  return methods;
}

function extractKotlinMethods(node: SyntaxNode): JvmMethodModel[] {
  const methods: JvmMethodModel[] = [];
  const body =
    node.childForFieldName("body") ??
    node.children.find((child) => child.type === "class_body");
  if (body === undefined) {
    return methods;
  }
  for (const child of body.children) {
    if (child.type !== "function_declaration") {
      continue;
    }
    const method = extractKotlinMethod(child);
    if (method !== undefined) {
      methods.push(method);
    }
  }
  return methods;
}

function extractJavaMethod(node: SyntaxNode): JvmMethodModel | undefined {
  const nameNode = node.childForFieldName("name");
  if (!nameNode) {
    return undefined;
  }
  const returnTypeNode = node.childForFieldName("type");
  return {
    name: nameNode.text,
    annotations: extractAnnotations(node),
    parameterTypes: extractParameterTypes(node),
    returnType: returnTypeNode?.text ?? "void",
  };
}

function extractKotlinMethod(node: SyntaxNode): JvmMethodModel | undefined {
  const nameNode = node.childForFieldName("name") ?? findChildTypeIdentifier(node);
  if (!nameNode) {
    return undefined;
  }
  const returnTypeNode = findReturnType(node);
  return {
    name: nameNode.text,
    annotations: extractAnnotations(node),
    parameterTypes: extractParameterTypes(node),
    returnType: returnTypeNode?.text ?? "Unit",
  };
}

function findReturnType(node: SyntaxNode): SyntaxNode | undefined {
  for (const child of node.children) {
    if (child.type === "user_type" || child.type === "nullable_type") {
      return child;
    }
  }
  return undefined;
}

function extractParameterTypes(node: SyntaxNode): string[] {
  const parameters: string[] = [];
  const paramsNode =
    node.childForFieldName("parameters") ??
    node.children.find((child) => child.type === "formal_parameters" || child.type === "function_value_parameters");
  if (!paramsNode) {
    return parameters;
  }
  for (const child of paramsNode.children) {
    if (
      child.type !== "formal_parameter" &&
      child.type !== "required_parameter" &&
      child.type !== "class_parameter" &&
      child.type !== "parameter"
    ) {
      continue;
    }
    const typeNode =
      child.childForFieldName("type") ??
      child.children.find(
        (parameterChild) =>
          parameterChild.type === "type_identifier" ||
          parameterChild.type === "user_type" ||
          parameterChild.type === "generic_type" ||
          parameterChild.type === "nullable_type",
      );
    if (typeNode) {
      parameters.push(typeNode.text);
    }
  }
  return parameters;
}

function extractAnnotations(node: SyntaxNode): JvmAnnotation[] {
  const annotations: JvmAnnotation[] = [];
  const modifiers = node.children.find((child) => child.type === "modifiers");
  if (!modifiers) {
    return annotations;
  }
  for (const child of modifiers.children) {
    if (child.type === "marker_annotation" || child.type === "annotation") {
      annotations.push(parseAnnotation(child));
    }
  }
  return annotations;
}

function parseAnnotation(node: SyntaxNode): JvmAnnotation {
  const nameNode =
    node.childForFieldName("name") ??
    node.children.find((child) => child.type === "type_identifier" || child.type === "user_type" || child.type === "identifier");
  const name = nameNode?.text ?? node.text.replace(/^@/, "").split("(")[0] ?? "";
  const attributes: Record<string, string | string[]> = {};

  const argumentsNode =
    node.childForFieldName("arguments") ??
    node.children.find((child) => child.type === "annotation_argument_list" || child.type === "value_arguments");

  if (argumentsNode) {
    parseAnnotationArguments(argumentsNode, attributes);
  }

  for (const child of node.children) {
    if (child.type === "element_value_pair") {
      const keyNode = child.childForFieldName("key");
      const valueNode = child.childForFieldName("value");
      if (keyNode && valueNode) {
        attributes[keyNode.text] = extractStringLiteral(valueNode);
      }
      continue;
    }
    if (child.type === "element_value" || child.type === "string_literal") {
      attributes.value = extractStringLiteral(child);
    }
    if (child.type === "value_arguments") {
      parseKotlinValueArguments(child, attributes);
    }
  }

  return { name, attributes };
}

function parseAnnotationArguments(
  node: SyntaxNode,
  attributes: Record<string, string | string[]>,
): void {
  for (const child of node.children) {
    if (child.type === "element_value_pair") {
      const keyNode = child.childForFieldName("key");
      const valueNode = child.childForFieldName("value");
      if (keyNode && valueNode) {
        attributes[keyNode.text] = extractStringLiteral(valueNode);
      }
      continue;
    }
    if (child.type === "string_literal") {
      attributes.value = extractStringLiteral(child);
      continue;
    }
    if (child.type === "annotation_argument_list") {
      parseAnnotationArguments(child, attributes);
    }
  }
}

function parseKotlinValueArguments(node: SyntaxNode, attributes: Record<string, string | string[]>): void {
  for (const child of node.children) {
    if (child.type !== "value_argument") {
      continue;
    }
    const nameNode = child.childForFieldName("name");
    const valueNode = child.children.find((argumentChild) => argumentChild.type === "string_literal");
    const value = valueNode ? extractStringLiteral(valueNode) : "";
    if (nameNode) {
      attributes[nameNode.text] = value;
    } else {
      attributes.value = value;
    }
  }
}

function extractStringLiteral(node: SyntaxNode): string {
  if (node.type === "string_literal") {
    const content =
      node.children.find(
        (child) => child.type === "string_content" || child.type === "string_fragment",
      ) ?? node.children.find((child) => child.type === "line_string_content");
    return content?.text ?? node.text.replace(/^["']|["']$/g, "");
  }
  if (node.type === "element_value_array_initializer") {
    const values: string[] = [];
    for (const child of node.children) {
      if (child.type === "string_literal") {
        values.push(extractStringLiteral(child));
      }
    }
    return values.length === 1 ? values[0]! : values.join(",");
  }
  const literal = node.children.find((child) => child.type === "string_literal");
  if (literal) {
    return extractStringLiteral(literal);
  }
  return node.text.replace(/^["']|["']$/g, "");
}

export function resolveTypeName(
  literalName: string,
  importContext: JvmImportContext,
  language: "java" | "kotlin",
): string {
  try {
    if (language === "java") {
      return resolveJavaFqcn(literalName, importContext);
    }
    return resolveKotlinFqcn(literalName, importContext);
  } catch {
    if (literalName.includes(".")) {
      return literalName;
    }
    if (importContext.packageName.length > 0) {
      return `${importContext.packageName}.${literalName}`;
    }
    return literalName;
  }
}

export function annotationMatches(annotation: JvmAnnotation, simpleOrSuffix: string): boolean {
  const name = annotation.name;
  return name === simpleOrSuffix || name.endsWith(`.${simpleOrSuffix}`);
}

export function annotationStringAttribute(
  annotation: JvmAnnotation,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = annotation.attributes[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  const fallback = annotation.attributes.value;
  return typeof fallback === "string" ? fallback : undefined;
}
