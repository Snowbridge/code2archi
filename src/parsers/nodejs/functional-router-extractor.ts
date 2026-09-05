import type { SyntaxNode } from "tree-sitter";
import { formatEndpoint } from "../java/rest/rest-path-normalizer.js";
import { joinPaths } from "../java/rest/rest-path-normalizer.js";
import {
  childByField,
  extractIdentifierName,
  nodeChildren,
  nodeText,
  unwrapExpression,
  walkNodes,
} from "./nodejs-tree-sitter-utils.js";
import {
  collectDtoTypesFromParameters,
  resolveTcpStackTypeFromHandler,
} from "./nodejs-module-scan.js";
import {
  collectFileLevelStringConstants,
  extractHttpMethodFromPropertyName,
  extractMethodFromRouteOptions,
  resolvePathWithConstants,
} from "./rest-path-resolver.js";
import type { NodejsCompilationUnit } from "./typescript-compilation-unit.js";

export type NodejsServerFramework = "express" | "fastify" | "hono" | "koa";

export interface ParsedFunctionalRouter {
  readonly exportName: string;
  readonly endpoints: readonly string[];
  readonly dtoTypes: readonly string[];
  readonly tcpStackType: "BLOCKING" | "NON_BLOCKING";
  readonly serverFramework: NodejsServerFramework;
}

const ROUTER_METHOD_NAMES = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "all",
  "use",
  "route",
]);

function detectServerFramework(unit: NodejsCompilationUnit): NodejsServerFramework | undefined {
  const source = unit.source;
  if (source.includes("from 'fastify'") || source.includes('from "fastify"')) {
    return "fastify";
  }

  if (source.includes("from 'hono'") || source.includes('from "hono"')) {
    return "hono";
  }

  if (
    source.includes("@koa/router") ||
    source.includes("koa-router") ||
    source.includes("from 'koa'") ||
    source.includes('from "koa"')
  ) {
    return "koa";
  }

  if (source.includes("from 'express'") || source.includes('from "express"')) {
    return "express";
  }

  return undefined;
}

function extractCallExpressionRoute(
  callNode: SyntaxNode,
  source: string,
  constants: ReadonlyMap<string, string>,
  basePath: string,
): { readonly method: string; readonly path: string; readonly handler?: SyntaxNode } | undefined {
  const functionNode = childByField(callNode, "function");
  const argumentsNode = childByField(callNode, "arguments");
  if (!functionNode || !argumentsNode) {
    return undefined;
  }

  const propertyName = extractIdentifierName(functionNode, source)?.toLowerCase();
  if (!propertyName || !ROUTER_METHOD_NAMES.has(propertyName)) {
    return undefined;
  }

  const args = nodeChildren(argumentsNode).filter((child) => child.type !== "," && child.type !== "(" && child.type !== ")");
  if (args.length === 0) {
    return undefined;
  }

  if (propertyName === "route") {
    const options = args[0];
    if (options?.type === "object") {
      const { method, path } = extractMethodFromRouteOptions(options, source);
      if (method && path) {
        return {
          method,
          path: joinPaths(basePath, path),
          handler: args[1],
        };
      }
    }
    return undefined;
  }

  const method = extractHttpMethodFromPropertyName(propertyName);
  if (!method) {
    return undefined;
  }

  const pathValue = resolvePathWithConstants(args[0], source, constants);
  if (!pathValue) {
    return undefined;
  }

  const handler = args.find(
    (argument) =>
      argument.type === "arrow_function" ||
      argument.type === "function_expression" ||
      argument.type === "identifier",
  );

  return {
    method,
    path: joinPaths(basePath, pathValue),
    handler,
  };
}

function collectRoutesFromNode(
  node: SyntaxNode,
  source: string,
  constants: ReadonlyMap<string, string>,
  basePath: string,
  routes: Array<{ method: string; path: string; handler?: SyntaxNode }>,
): void {
  walkNodes(node, (current) => {
    if (current.type !== "call_expression") {
      return;
    }

    const route = extractCallExpressionRoute(current, source, constants, basePath);
    if (route) {
      routes.push(route);
    }
  });
}

function extractExportName(declarationNode: SyntaxNode, source: string): string | undefined {
  if (declarationNode.type === "function_declaration") {
    const nameNode = childByField(declarationNode, "name");
    return nameNode ? nodeText(nameNode, source) : undefined;
  }

  if (declarationNode.type === "lexical_declaration" || declarationNode.type === "variable_declaration") {
    for (const declarator of nodeChildren(declarationNode)) {
      if (declarator.type !== "variable_declarator") {
        continue;
      }

      const nameNode = childByField(declarator, "name");
      if (nameNode?.type === "identifier") {
        return nodeText(nameNode, source);
      }
    }
  }

  return undefined;
}

function extractDeclarationBody(declarationNode: SyntaxNode): SyntaxNode {
  if (declarationNode.type === "function_declaration") {
    return childByField(declarationNode, "body") ?? declarationNode;
  }

  if (declarationNode.type === "lexical_declaration" || declarationNode.type === "variable_declaration") {
    for (const declarator of nodeChildren(declarationNode)) {
      const valueNode = childByField(declarator, "value");
      if (valueNode) {
        return unwrapExpression(valueNode);
      }
    }
  }

  return declarationNode;
}

function parseFunctionalRouterFromDeclaration(
  declarationNode: SyntaxNode,
  unit: NodejsCompilationUnit,
  serverFramework: NodejsServerFramework,
): ParsedFunctionalRouter | undefined {
  const exportName = extractExportName(declarationNode, unit.source);
  if (!exportName) {
    return undefined;
  }

  const constants = collectFileLevelStringConstants(unit.root, unit.source);
  const body = extractDeclarationBody(declarationNode);
  const routes: Array<{ method: string; path: string; handler?: SyntaxNode }> = [];
  collectRoutesFromNode(body, unit.source, constants, "", routes);

  if (routes.length === 0) {
    return undefined;
  }

  const endpoints = [...new Set(routes.map((route) => formatEndpoint(route.method, route.path)))].sort();
  const dtoTypes = new Set<string>();
  let tcpStackType: "BLOCKING" | "NON_BLOCKING" = "BLOCKING";

  for (const route of routes) {
    if (route.handler && (route.handler.type === "arrow_function" || route.handler.type === "function_expression")) {
      const parameters = nodeChildren(childByField(route.handler, "parameters") ?? route.handler).filter(
        (child) => child.type === "required_parameter" || child.type === "optional_parameter",
      );
      for (const dtoType of collectDtoTypesFromParameters(parameters, unit.source)) {
        dtoTypes.add(dtoType);
      }

      if (resolveTcpStackTypeFromHandler(route.handler, unit.source) === "NON_BLOCKING") {
        tcpStackType = "NON_BLOCKING";
      }
    }
  }

  return {
    exportName,
    endpoints,
    dtoTypes: [...dtoTypes].sort(),
    tcpStackType,
    serverFramework,
  };
}

export function extractFunctionalRouters(unit: NodejsCompilationUnit): ParsedFunctionalRouter[] {
  const serverFramework = detectServerFramework(unit);
  if (!serverFramework) {
    return [];
  }

  const routers: ParsedFunctionalRouter[] = [];

  walkNodes(unit.root, (node) => {
    if (node.type === "export_statement") {
      const declaration = nodeChildren(node).find(
        (child) =>
          child.type === "function_declaration" ||
          child.type === "lexical_declaration" ||
          child.type === "variable_declaration",
      );

      if (!declaration) {
        return;
      }

      const parsed = parseFunctionalRouterFromDeclaration(declaration, unit, serverFramework);
      if (parsed) {
        routers.push(parsed);
      }
      return;
    }

    if (
      node.type === "function_declaration" ||
      node.type === "lexical_declaration" ||
      node.type === "variable_declaration"
    ) {
      const parsed = parseFunctionalRouterFromDeclaration(node, unit, serverFramework);
      if (parsed) {
        routers.push(parsed);
      }
    }
  });

  const unique = new Map<string, ParsedFunctionalRouter>();
  for (const router of routers) {
    unique.set(router.exportName, router);
  }

  return [...unique.values()];
}
