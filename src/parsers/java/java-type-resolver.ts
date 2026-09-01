import type { JavaTypeRef } from "./java-ast-model.js";
import {
  asGenericCstNode,
  firstChild,
  getTokenImage,
  type GenericCstNode,
} from "./java-cst-utils.js";

const PRIMITIVE_TYPES = new Set([
  "boolean",
  "byte",
  "char",
  "double",
  "float",
  "int",
  "long",
  "short",
  "void",
]);

const WRAPPER_TYPES = new Set([
  "Boolean",
  "Byte",
  "Character",
  "Double",
  "Float",
  "Integer",
  "Long",
  "Short",
  "Void",
]);

const EXCLUDED_SIMPLE_TYPES = new Set(["String", "Object"]);

const FRAMEWORK_EXCLUDED_TYPES = new Set([
  "ResponseEntity",
  "HttpEntity",
  "HttpResponse",
  "MutableHttpResponse",
  "Mono",
  "Flux",
  "Publisher",
  "Uni",
  "Multi",
  "Optional",
]);

export function parseTypeRef(node: GenericCstNode | undefined): JavaTypeRef | undefined {
  if (!node) {
    return undefined;
  }

  if (node.name === "unannType" || node.name === "result" || node.name === "type") {
    if (!node.children) {
      return undefined;
    }
    for (const childList of Object.values(node.children)) {
      for (const child of childList) {
        const genericChild = asGenericCstNode(child);
        if (!genericChild) {
          continue;
        }
        const parsed = parseTypeRef(genericChild);
        if (parsed) {
          return parsed;
        }
      }
    }
    return undefined;
  }

  if (
    node.name === "unannReferenceType" ||
    node.name === "referenceType" ||
    node.name === "classOrInterfaceType" ||
    node.name === "unannClassOrInterfaceType" ||
    node.name === "unannClassType" ||
    node.name === "classType"
  ) {
    return parseClassOrInterfaceType(node);
  }

  if (node.name === "typeIdentifier") {
    const identifier = getTokenImage(firstChild(node, "Identifier"));
    if (!identifier) {
      return undefined;
    }
    return {
      raw: identifier,
      simpleName: identifier,
      typeArguments: [],
    };
  }

  if (!node.children) {
    return undefined;
  }

  for (const childList of Object.values(node.children)) {
    for (const child of childList) {
      const genericChild = asGenericCstNode(child);
      if (!genericChild) {
        continue;
      }
      const parsed = parseTypeRef(genericChild);
      if (parsed) {
        return parsed;
      }
    }
  }

  return undefined;
}

function parseClassOrInterfaceType(node: GenericCstNode): JavaTypeRef | undefined {
  const unannClassType = firstChild(firstChild(node, "unannClassOrInterfaceType"), "unannClassType");
  const classType = firstChild(unannClassType ?? node, "classType");
  const targetNode = classType ?? unannClassType ?? node;

  const identifiers: string[] = [];
  const typeArguments: JavaTypeRef[] = [];

  function walkTypeNode(current: GenericCstNode): void {
    if (!current.children) {
      return;
    }

    if (current.children.Identifier) {
      for (const token of current.children.Identifier) {
        const image = getTokenImage(token);
        if (image) {
          identifiers.push(image);
        }
      }
    }

    for (const childList of Object.values(current.children)) {
      for (const child of childList) {
        const genericChild = asGenericCstNode(child);
        if (!genericChild) {
          continue;
        }
        if (genericChild.name === "Identifier") {
          const image = getTokenImage(genericChild);
          if (image) {
            identifiers.push(image);
          }
        } else if (genericChild.children?.Identifier) {
          for (const token of genericChild.children.Identifier) {
            const image = getTokenImage(token);
            if (image) {
              identifiers.push(image);
            }
          }
        } else if (genericChild.name === "typeArguments") {
          for (const typeArgumentListNode of childNodes(genericChild, "typeArgumentList")) {
            for (const typeArgumentNode of childNodes(typeArgumentListNode, "typeArgument")) {
              const parsed = parseTypeArgument(typeArgumentNode);
              if (parsed) {
                typeArguments.push(parsed);
              }
            }
          }
        } else if (
          genericChild.name === "classOrInterfaceType" ||
          genericChild.name === "classType" ||
          genericChild.name === "interfaceType" ||
          genericChild.name === "unannClassOrInterfaceType" ||
          genericChild.name === "unannClassType" ||
          genericChild.name === "referenceType" ||
          genericChild.name === "unannReferenceType"
        ) {
          walkTypeNode(genericChild);
        } else if (genericChild.name) {
          walkTypeNode(genericChild);
        }
      }
    }
  }

  walkTypeNode(targetNode);

  if (identifiers.length === 0) {
    return undefined;
  }

  const simpleName = identifiers[identifiers.length - 1] ?? "";
  return {
    raw: identifiers.join("."),
    simpleName,
    typeArguments,
  };
}

function childNodes(node: GenericCstNode | undefined, childName: string): GenericCstNode[] {
  const children = node?.children?.[childName];
  if (!children) {
    return [];
  }
  return children.map(asGenericCstNode).filter((child): child is GenericCstNode => child !== undefined);
}

function parseTypeArgument(node: GenericCstNode): JavaTypeRef | undefined {
  if (!node.children) {
    return undefined;
  }

  for (const childList of Object.values(node.children)) {
    for (const child of childList) {
      const genericChild = asGenericCstNode(child);
      if (!genericChild) {
        continue;
      }
      if (genericChild.name === "wildcard") {
        return undefined;
      }
      const parsed = parseTypeRef(genericChild);
      if (parsed) {
        return parsed;
      }
    }
  }

  return undefined;
}

export function resolveTypeFqcn(
  typeRef: JavaTypeRef,
  packageName: string | undefined,
  imports: ReadonlyMap<string, string>,
): string {
  if (typeRef.raw.includes(".")) {
    return typeRef.raw;
  }

  const imported = imports.get(typeRef.simpleName);
  if (imported) {
    return imported;
  }

  if (packageName) {
    return `${packageName}.${typeRef.simpleName}`;
  }

  return typeRef.simpleName;
}

export function flattenTypeRefs(typeRef: JavaTypeRef | undefined): JavaTypeRef[] {
  if (!typeRef) {
    return [];
  }

  return [typeRef, ...typeRef.typeArguments.flatMap((argument) => flattenTypeRefs(argument))];
}

export function unwrapTypeArguments(
  typeRef: JavaTypeRef | undefined,
  wrapperSimpleNames: ReadonlySet<string>,
): JavaTypeRef | undefined {
  if (!typeRef) {
    return undefined;
  }

  if (wrapperSimpleNames.has(typeRef.simpleName) && typeRef.typeArguments.length > 0) {
    return unwrapTypeArguments(typeRef.typeArguments[0], wrapperSimpleNames);
  }

  return typeRef;
}

export function isPrimitiveOrWrapper(simpleName: string): boolean {
  return PRIMITIVE_TYPES.has(simpleName) || WRAPPER_TYPES.has(simpleName);
}

export function isExcludedDtoType(fqcn: string, wrapperSimpleNames: ReadonlySet<string>): boolean {
  const simpleName = fqcn.includes(".") ? (fqcn.split(".").at(-1) ?? fqcn) : fqcn;

  if (isPrimitiveOrWrapper(simpleName)) {
    return true;
  }

  if (EXCLUDED_SIMPLE_TYPES.has(simpleName)) {
    return true;
  }

  if (wrapperSimpleNames.has(simpleName) || FRAMEWORK_EXCLUDED_TYPES.has(simpleName)) {
    return true;
  }

  if (
    fqcn.startsWith("java.") ||
    fqcn.startsWith("javax.") ||
    fqcn.startsWith("jakarta.")
  ) {
    return true;
  }

  return false;
}

export function collectCollectionElementTypes(typeRef: JavaTypeRef): JavaTypeRef[] {
  const collectionTypes = new Set(["List", "Set", "Collection", "Iterable", "Stream"]);
  if (collectionTypes.has(typeRef.simpleName) && typeRef.typeArguments.length > 0) {
    return flattenTypeRefs(typeRef.typeArguments[0]);
  }

  if (typeRef.raw.endsWith("[]") && typeRef.typeArguments.length > 0) {
    return flattenTypeRefs(typeRef.typeArguments[0]);
  }

  return [];
}
