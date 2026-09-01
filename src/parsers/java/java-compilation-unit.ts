import { parse } from "java-parser";
import { collectModifierAnnotations } from "./java-annotation-utils.js";
import type {
  JavaCompilationUnit,
  JavaMethodDeclaration,
  JavaParameter,
  JavaTypeDeclaration,
  JavaTypeRef,
} from "./java-ast-model.js";
import {
  asGenericCstNode,
  childNodes,
  firstChild,
  getTokenImage,
  walkDescendants,
  type GenericCstNode,
} from "./java-cst-utils.js";
import { parseTypeRef } from "./java-type-resolver.js";

function collectPackageIdentifiers(node: GenericCstNode, parts: string[]): void {
  if (!node.children) {
    return;
  }

  const directIdentifierTokens = node.children.Identifier;
  if (directIdentifierTokens) {
    for (const token of directIdentifierTokens) {
      const image = getTokenImage(token);
      if (image) {
        parts.push(image);
      }
    }
    return;
  }

  for (const childList of Object.values(node.children)) {
    for (const child of childList) {
      const genericChild = asGenericCstNode(child);
      if (!genericChild) {
        continue;
      }
      if (genericChild.name === "Identifier") {
        const image = getTokenImage(genericChild);
        if (image) {
          parts.push(image);
        }
      } else {
        collectPackageIdentifiers(genericChild, parts);
      }
    }
  }
}

function getCompilationBody(cst: GenericCstNode): GenericCstNode {
  return firstChild(cst, "ordinaryCompilationUnit") ?? firstChild(cst, "modularCompilationUnit") ?? cst;
}

function extractPackageName(cst: GenericCstNode): string | undefined {
  const compilationBody = getCompilationBody(cst);
  const packageDeclaration = firstChild(compilationBody, "packageDeclaration");
  if (!packageDeclaration) {
    return undefined;
  }

  const packageNameNode = firstChild(packageDeclaration, "packageName");
  if (packageNameNode) {
    const parts: string[] = [];
    collectPackageIdentifiers(packageNameNode, parts);
    return parts.length > 0 ? parts.join(".") : undefined;
  }

  const parts: string[] = [];
  collectPackageIdentifiers(packageDeclaration, parts);
  return parts.length > 0 ? parts.join(".") : undefined;
}

function extractImports(cst: GenericCstNode): Map<string, string> {
  const imports = new Map<string, string>();
  const compilationBody = getCompilationBody(cst);

  for (const importDeclaration of childNodes(compilationBody, "importDeclaration")) {
    if (importDeclaration.children?.Star) {
      continue;
    }

    const packageOrTypeName = firstChild(importDeclaration, "packageOrTypeName");
    if (!packageOrTypeName) {
      continue;
    }

    const parts: string[] = [];
    collectPackageIdentifiers(packageOrTypeName, parts);
    if (parts.length === 0) {
      continue;
    }

    const fqcn = parts.join(".");
    const simpleName = parts.at(-1);
    if (simpleName) {
      imports.set(simpleName, fqcn);
    }
  }

  return imports;
}

function extractParameters(source: string, methodDeclarator: GenericCstNode | undefined): JavaParameter[] {
  const parameters: JavaParameter[] = [];
  const formalParameterList = firstChild(methodDeclarator, "formalParameterList");

  for (const formalParameter of childNodes(formalParameterList, "formalParameter")) {
    const variableParameter = firstChild(formalParameter, "variableParaRegularParameter");
    const typeNode =
      firstChild(variableParameter, "unannType") ?? firstChild(formalParameter, "unannType");
    const type = parseTypeRef(typeNode);
    if (!type) {
      continue;
    }

    const variableDeclaratorId = firstChild(variableParameter, "variableDeclaratorId");
    const annotations = collectModifierAnnotations(source, variableParameter?.children?.variableModifier);

    parameters.push({
      name: getTokenImage(variableDeclaratorId?.children?.Identifier?.[0]),
      type,
      annotations,
    });
  }

  return parameters;
}

function extractMethods(source: string, normalClass: GenericCstNode | undefined): JavaMethodDeclaration[] {
  const methods: JavaMethodDeclaration[] = [];
  const classBody = firstChild(normalClass, "classBody");

  for (const bodyDeclaration of childNodes(classBody, "classBodyDeclaration")) {
    const memberDeclaration = firstChild(bodyDeclaration, "classMemberDeclaration");
    const methodDeclaration =
      firstChild(bodyDeclaration, "methodDeclaration") ??
      firstChild(memberDeclaration, "methodDeclaration");
    if (!methodDeclaration) {
      continue;
    }

    const methodHeader = firstChild(methodDeclaration, "methodHeader");
    const methodDeclarator = firstChild(methodHeader, "methodDeclarator");
    const methodName = getTokenImage(methodDeclarator?.children?.Identifier?.[0]);
    if (!methodName) {
      continue;
    }

    methods.push({
      name: methodName,
      returnType: parseTypeRef(firstChild(methodHeader, "result")),
      parameters: extractParameters(source, methodDeclarator),
      annotations: collectModifierAnnotations(source, methodDeclaration.children?.methodModifier),
    });
  }

  return methods;
}

function extractInterfaces(normalClass: GenericCstNode | undefined): JavaTypeRef[] {
  const interfaceList = firstChild(normalClass, "interfaceTypeList");
  const interfaces: JavaTypeRef[] = [];

  if (!interfaceList?.children) {
    return interfaces;
  }

  for (const childList of Object.values(interfaceList.children)) {
    for (const child of childList) {
      const genericChild = asGenericCstNode(child);
      if (!genericChild) {
        continue;
      }
      const parsed = parseTypeRef(genericChild);
      if (parsed) {
        interfaces.push(parsed);
      }
    }
  }

  return interfaces;
}

function extractSuperClass(normalClass: GenericCstNode | undefined): JavaTypeRef | undefined {
  const classExtends = firstChild(normalClass, "classExtends");
  return parseTypeRef(firstChild(classExtends, "classType"));
}

function extractTypeName(normalClass: GenericCstNode | undefined): string | undefined {
  return getTokenImage(firstChild(normalClass, "typeIdentifier"));
}

function extractClassDeclaration(
  source: string,
  classDeclaration: GenericCstNode,
  outerTypeStack: readonly string[],
  sink: JavaTypeDeclaration[],
): void {
  const normalClass = firstChild(classDeclaration, "normalClassDeclaration");
  const className = extractTypeName(normalClass);
  if (!className) {
    return;
  }

  const nestedStart = sink.length;
  const nextOuterStack = [...outerTypeStack, className];

  for (const nestedClass of walkDescendants(normalClass, "classDeclaration")) {
    if (nestedClass === classDeclaration) {
      continue;
    }
    extractClassDeclaration(source, nestedClass, nextOuterStack, sink);
  }

  const nestedTypes = sink.splice(nestedStart);

  sink.push({
    name: className,
    fqcn: [...outerTypeStack, className].join("$"),
    annotations: collectModifierAnnotations(source, classDeclaration.children?.classModifier),
    superClass: extractSuperClass(normalClass),
    interfaces: extractInterfaces(normalClass),
    methods: extractMethods(source, normalClass),
    nestedTypes,
  });
}

function prefixFqcn(type: JavaTypeDeclaration, packagePrefix: string): JavaTypeDeclaration {
  const fqcn = packagePrefix ? `${packagePrefix}.${type.fqcn}` : type.fqcn;
  return {
    ...type,
    fqcn,
    nestedTypes: type.nestedTypes.map((nested) => prefixFqcn(nested, packagePrefix)),
  };
}

export function parseJavaCompilationUnit(source: string): JavaCompilationUnit {
  const cst = asGenericCstNode(parse(source));
  if (!cst) {
    throw new Error("Failed to parse Java source");
  }

  const packageName = extractPackageName(cst);
  const imports = extractImports(cst);
  const compilationBody = getCompilationBody(cst);
  const types: JavaTypeDeclaration[] = [];

  for (const typeDeclaration of childNodes(compilationBody, "typeDeclaration")) {
    const classDeclaration = firstChild(typeDeclaration, "classDeclaration");
    if (classDeclaration) {
      extractClassDeclaration(source, classDeclaration, [], types);
    }
  }

  return {
    packageName,
    imports,
    types: types.map((type) => prefixFqcn(type, packageName ?? "")),
  };
}

export function parseJavaSourceFile(source: string): JavaCompilationUnit {
  return parseJavaCompilationUnit(source);
}
