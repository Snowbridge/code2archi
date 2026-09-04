import type { SyntaxNode } from "tree-sitter";
import { formatEndpoint } from "../java/rest/rest-path-normalizer.js";
import { joinPaths } from "../java/rest/rest-path-normalizer.js";
import {
  childByField,
  findDirectChildren,
  nodeChildren,
  nodeText,
  walkNodes,
} from "./nodejs-tree-sitter-utils.js";
import {
  collectDtoTypesFromParameters,
  resolveTcpStackTypeFromHandler,
} from "./nodejs-module-scan.js";
import { resolvePathArgument } from "./rest-path-resolver.js";
import type { NodejsCompilationUnit } from "./typescript-compilation-unit.js";

export interface ParsedNestJsController {
  readonly className: string;
  readonly basePath: string;
  readonly endpoints: readonly string[];
  readonly dtoTypes: readonly string[];
  readonly tcpStackType: "BLOCKING" | "NON_BLOCKING";
  readonly implementsTypeNames: readonly string[];
  readonly extendsTypeName?: string;
}

const NEST_HTTP_DECORATORS = new Set([
  "Get",
  "Post",
  "Put",
  "Patch",
  "Delete",
  "Head",
  "Options",
  "All",
]);

function readDecoratorExpression(decoratorNode: SyntaxNode): SyntaxNode | undefined {
  const byField = childByField(decoratorNode, "expression");
  if (byField && byField.type !== "@") {
    return byField;
  }

  return (
    findDirectChildren(decoratorNode, "call_expression")[0] ??
    findDirectChildren(decoratorNode, "identifier")[0]
  );
}

function readDecoratorName(decoratorNode: SyntaxNode, source: string): string | undefined {
  const expression = readDecoratorExpression(decoratorNode);
  if (!expression) {
    return undefined;
  }

  if (expression.type === "identifier") {
    return nodeText(expression, source);
  }

  if (expression.type === "call_expression") {
    const callee = childByField(expression, "function");
    if (callee?.type === "identifier") {
      return nodeText(callee, source);
    }
  }

  return undefined;
}

function readDecoratorStringArgument(decoratorNode: SyntaxNode, source: string): string | undefined {
  const expression = readDecoratorExpression(decoratorNode);
  if (!expression || expression.type !== "call_expression") {
    return undefined;
  }

  const argumentsNode = childByField(expression, "arguments");
  if (!argumentsNode) {
    return undefined;
  }

  const firstArgument = nodeChildren(argumentsNode).find(
    (child) => child.type !== "," && child.type !== "(" && child.type !== ")",
  );

  return firstArgument ? resolvePathArgument(firstArgument, source) : undefined;
}

function extractClassDecorators(classNode: SyntaxNode): SyntaxNode[] {
  const directDecorators = findDirectChildren(classNode, "decorator");
  if (directDecorators.length > 0) {
    return directDecorators;
  }

  const parent = classNode.parent;
  if (parent?.type === "export_statement") {
    return findDirectChildren(parent, "decorator");
  }

  return [];
}

function extractMethodDecorators(methodNode: SyntaxNode, source: string): Array<{ name: string; path?: string }> {
  const decorators: Array<{ name: string; path?: string }> = [];

  for (const decorator of findDirectChildren(methodNode, "decorator")) {
    const name = readDecoratorName(decorator, source);
    if (!name) {
      continue;
    }

    decorators.push({
      name,
      path: readDecoratorStringArgument(decorator, source),
    });
  }

  return decorators;
}

function extractHeritage(classNode: SyntaxNode, source: string): {
  readonly extendsTypeName?: string;
  readonly implementsTypeNames: readonly string[];
} {
  let extendsTypeName: string | undefined;
  const implementsTypeNames: string[] = [];

  for (const child of nodeChildren(classNode)) {
    if (child.type === "class_heritage") {
      for (const heritageChild of nodeChildren(child)) {
        if (heritageChild.type === "extends_clause") {
          const value = nodeChildren(heritageChild).find((node) => node.type === "identifier");
          if (value) {
            extendsTypeName = nodeText(value, source);
          }
        }

        if (heritageChild.type === "implements_clause") {
          for (const typeNode of nodeChildren(heritageChild)) {
            if (typeNode.type === "type_identifier" || typeNode.type === "identifier") {
              implementsTypeNames.push(nodeText(typeNode, source));
            }
          }
        }
      }
    }
  }

  return {
    ...(extendsTypeName ? { extendsTypeName } : {}),
    implementsTypeNames: [...new Set(implementsTypeNames)].sort(),
  };
}

export function extractNestJsControllers(unit: NodejsCompilationUnit): ParsedNestJsController[] {
  if (!unit.source.includes("@nestjs/common") && !unit.source.includes("@Controller")) {
    return [];
  }

  const controllers: ParsedNestJsController[] = [];

  walkNodes(unit.root, (node) => {
    if (node.type !== "class_declaration") {
      return;
    }

    const classDecorators = extractClassDecorators(node);
    const hasControllerDecorator = classDecorators.some(
      (decorator) => readDecoratorName(decorator, unit.source) === "Controller",
    );

    if (!hasControllerDecorator) {
      return;
    }

    const classNameNode = childByField(node, "name");
    if (!classNameNode) {
      return;
    }

    const className = nodeText(classNameNode, unit.source);
    const basePath =
      classDecorators
        .map((decorator) => readDecoratorStringArgument(decorator, unit.source))
        .find((value) => value !== undefined) ?? "";

    const endpoints: string[] = [];
    const dtoTypes = new Set<string>();
    let tcpStackType: "BLOCKING" | "NON_BLOCKING" = "BLOCKING";

    const classBody = childByField(node, "body");
    if (classBody) {
      const pendingDecorators: SyntaxNode[] = [];

      for (const member of nodeChildren(classBody)) {
        if (member.type === "decorator") {
          pendingDecorators.push(member);
          continue;
        }

        if (member.type !== "method_definition" && member.type !== "public_field_definition") {
          continue;
        }

        const methodDecorators = [
          ...pendingDecorators.map((decorator) => ({
            name: readDecoratorName(decorator, unit.source) ?? "",
            path: readDecoratorStringArgument(decorator, unit.source),
          })),
          ...extractMethodDecorators(member, unit.source),
        ];
        pendingDecorators.length = 0;

        const httpDecorator = methodDecorators.find((decorator) =>
          NEST_HTTP_DECORATORS.has(decorator.name),
        );

        if (!httpDecorator) {
          continue;
        }

        const methodPath = httpDecorator.path ?? "";
        endpoints.push(formatEndpoint(httpDecorator.name.toUpperCase(), joinPaths(basePath, methodPath)));

        const parameters = nodeChildren(childByField(member, "parameters") ?? member).filter(
          (child) => child.type === "required_parameter" || child.type === "optional_parameter",
        );
        for (const dtoType of collectDtoTypesFromParameters(parameters, unit.source)) {
          dtoTypes.add(dtoType);
        }

        if (resolveTcpStackTypeFromHandler(member, unit.source) === "NON_BLOCKING") {
          tcpStackType = "NON_BLOCKING";
        }
      }
    }

    if (endpoints.length === 0) {
      return;
    }

    const heritage = extractHeritage(node, unit.source);
    controllers.push({
      className,
      basePath,
      endpoints: [...new Set(endpoints)].sort(),
      dtoTypes: [...dtoTypes].sort(),
      tcpStackType,
      implementsTypeNames: heritage.implementsTypeNames,
      ...(heritage.extendsTypeName ? { extendsTypeName: heritage.extendsTypeName } : {}),
    });
  });

  return controllers;
}
