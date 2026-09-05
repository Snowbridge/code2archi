import type { SyntaxNode } from "tree-sitter";
import { formatEndpoint } from "../java/rest/rest-path-normalizer.js";
import {
  childByField,
  extractIdentifierName,
  nodeChildren,
  nodeText,
  unwrapExpression,
  walkNodes,
} from "./nodejs-tree-sitter-utils.js";
import {
  collectFileLevelStringConstants,
  extractHttpMethodFromPropertyName,
  extractMethodFromRouteOptions,
  resolvePathWithConstants,
} from "./rest-path-resolver.js";
import type { NodejsCompilationUnit } from "./typescript-compilation-unit.js";

export type NodejsClientFramework =
  | "axios"
  | "fetch"
  | "undici"
  | "got"
  | "node-http"
  | "superagent"
  | "nestjs-axios";

export interface ParsedProgrammaticHttpClient {
  readonly exportName: string;
  readonly endpoints: readonly string[];
  readonly clientFramework: NodejsClientFramework;
  readonly baseUrl?: string;
}

const AXIOS_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options", "request"]);
const GOT_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);
const SUPERAGENT_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);
const NEST_HTTP_SERVICE_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options", "request"]);

function detectClientFrameworkFromCallee(
  callee: SyntaxNode,
  source: string,
): NodejsClientFramework | undefined {
  const calleeText = nodeText(callee, source);

  if (calleeText === "fetch" || calleeText.endsWith(".fetch")) {
    return "fetch";
  }

  if (calleeText === "axios" || calleeText.endsWith(".axios")) {
    return "axios";
  }

  if (calleeText === "got" || calleeText.endsWith(".got")) {
    return "got";
  }

  if (calleeText.includes("HttpService") || calleeText.endsWith("httpService")) {
    return "nestjs-axios";
  }

  if (calleeText.includes("request") && calleeText.includes("superagent")) {
    return "superagent";
  }

  const propertyName = extractIdentifierName(callee, source)?.toLowerCase();
  if (!propertyName) {
    return undefined;
  }

  if (AXIOS_METHODS.has(propertyName) && (calleeText.includes("axios") || source.includes("axios"))) {
    return "axios";
  }

  if (GOT_METHODS.has(propertyName) && source.includes("got")) {
    return "got";
  }

  if (SUPERAGENT_METHODS.has(propertyName) && source.includes("superagent")) {
    return "superagent";
  }

  if (NEST_HTTP_SERVICE_METHODS.has(propertyName) && source.includes("@nestjs/axios")) {
    return "nestjs-axios";
  }

  if (propertyName === "request" && (calleeText.startsWith("http.") || calleeText.startsWith("https."))) {
    return "node-http";
  }

  if (propertyName === "request" && source.includes("undici")) {
    return "undici";
  }

  return undefined;
}

function extractEndpointFromCall(
  callNode: SyntaxNode,
  source: string,
  constants: ReadonlyMap<string, string>,
  clientFramework: NodejsClientFramework,
): string | undefined {
  const callee = childByField(callNode, "function");
  const argumentsNode = childByField(callNode, "arguments");
  if (!callee || !argumentsNode) {
    return undefined;
  }

  const propertyName = extractIdentifierName(callee, source)?.toLowerCase();
  const args = nodeChildren(argumentsNode).filter((child) => child.type !== "," && child.type !== "(" && child.type !== ")");

  if (clientFramework === "fetch" || clientFramework === "undici") {
    const pathValue = args[0] ? resolvePathWithConstants(args[0], source, constants) : undefined;
    return pathValue ? formatEndpoint("GET", pathValue) : undefined;
  }

  if (clientFramework === "node-http") {
    const options = args[0];
    if (options?.type === "object") {
      const { method, path } = extractMethodFromRouteOptions(options, source);
      if (path) {
        return formatEndpoint(method ?? "GET", path);
      }
    }
    return undefined;
  }

  if (!propertyName) {
    return undefined;
  }

  if (propertyName === "request") {
    const config = args[0];
    if (config?.type === "object") {
      const { method, path } = extractMethodFromRouteOptions(config, source);
      if (path) {
        return formatEndpoint(method ?? "GET", path);
      }
    }
  }

  const method = extractHttpMethodFromPropertyName(propertyName);
  if (!method) {
    return undefined;
  }

  const pathValue = args[0] ? resolvePathWithConstants(args[0], source, constants) : undefined;
  if (!pathValue) {
    return undefined;
  }

  return formatEndpoint(method, pathValue);
}

function extractExportName(node: SyntaxNode, source: string): string | undefined {
  if (node.type === "function_declaration") {
    const nameNode = childByField(node, "name");
    return nameNode ? nodeText(nameNode, source) : undefined;
  }

  if (node.type === "class_declaration") {
    const nameNode = childByField(node, "name");
    return nameNode ? nodeText(nameNode, source) : undefined;
  }

  if (node.type === "lexical_declaration" || node.type === "variable_declaration") {
    for (const declarator of nodeChildren(node)) {
      const nameNode = childByField(declarator, "name");
      if (nameNode?.type === "identifier") {
        return nodeText(nameNode, source);
      }
    }
  }

  return undefined;
}

function collectEndpointsInScope(
  scopeNode: SyntaxNode,
  source: string,
  constants: ReadonlyMap<string, string>,
): Array<{ endpoint: string; clientFramework: NodejsClientFramework }> {
  const endpoints: Array<{ endpoint: string; clientFramework: NodejsClientFramework }> = [];

  walkNodes(scopeNode, (current) => {
    if (current.type !== "call_expression") {
      return;
    }

    const callee = childByField(current, "function");
    if (!callee) {
      return;
    }

    const clientFramework = detectClientFrameworkFromCallee(callee, source);
    if (!clientFramework) {
      return;
    }

    const endpoint = extractEndpointFromCall(current, source, constants, clientFramework);
    if (endpoint) {
      endpoints.push({ endpoint, clientFramework });
    }
  });

  return endpoints;
}

function parseClientFromDeclaration(
  declarationNode: SyntaxNode,
  unit: NodejsCompilationUnit,
): ParsedProgrammaticHttpClient | undefined {
  const exportName = extractExportName(declarationNode, unit.source);
  if (!exportName) {
    return undefined;
  }

  const constants = collectFileLevelStringConstants(unit.root, unit.source);
  const body =
    declarationNode.type === "class_declaration"
      ? childByField(declarationNode, "body") ?? declarationNode
      : declarationNode.type === "function_declaration"
        ? childByField(declarationNode, "body") ?? declarationNode
        : (() => {
            for (const declarator of nodeChildren(declarationNode)) {
              const valueNode = childByField(declarator, "value");
              if (valueNode) {
                return unwrapExpression(valueNode);
              }
            }
            return declarationNode;
          })();

  const collected = collectEndpointsInScope(body, unit.source, constants);
  if (collected.length === 0) {
    return undefined;
  }

  const endpoints = [...new Set(collected.map((entry) => entry.endpoint))].sort();
  const clientFramework = collected[0].clientFramework;

  return {
    exportName,
    endpoints,
    clientFramework,
  };
}

export function extractProgrammaticHttpClients(unit: NodejsCompilationUnit): ParsedProgrammaticHttpClient[] {
  const clients: ParsedProgrammaticHttpClient[] = [];

  walkNodes(unit.root, (node) => {
    if (
      node.type === "export_statement" ||
      node.type === "function_declaration" ||
      node.type === "class_declaration" ||
      node.type === "lexical_declaration" ||
      node.type === "variable_declaration"
    ) {
      const declaration =
        node.type === "export_statement"
          ? nodeChildren(node).find(
              (child) =>
                child.type === "function_declaration" ||
                child.type === "class_declaration" ||
                child.type === "lexical_declaration" ||
                child.type === "variable_declaration",
            )
          : node;

      if (!declaration) {
        return;
      }

      const parsed = parseClientFromDeclaration(declaration, unit);
      if (parsed) {
        clients.push(parsed);
      }
    }
  });

  const unique = new Map<string, ParsedProgrammaticHttpClient>();
  for (const client of clients) {
    unique.set(client.exportName, client);
  }

  return [...unique.values()];
}
