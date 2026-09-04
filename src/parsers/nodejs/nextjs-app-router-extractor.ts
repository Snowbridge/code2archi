import path from "node:path";
import type { SyntaxNode } from "tree-sitter";
import { formatEndpoint } from "../java/rest/rest-path-normalizer.js";
import { normalizePathSegment } from "../java/rest/rest-path-normalizer.js";
import { childByField, nodeChildren, nodeText, walkNodes } from "./nodejs-tree-sitter-utils.js";
import {
  collectDtoTypesFromParameters,
  resolveTcpStackTypeFromHandler,
} from "./nodejs-module-scan.js";
import type { NodejsCompilationUnit } from "./typescript-compilation-unit.js";

export interface ParsedNextJsRouteFile {
  readonly routeFileRelativePath: string;
  readonly endpoints: readonly string[];
  readonly dtoTypes: readonly string[];
  readonly tcpStackType: "BLOCKING" | "NON_BLOCKING";
}

const HTTP_EXPORT_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

function convertNextJsSegmentsToPath(routeFileAbsolutePath: string, appRoot: string): string {
  const relative = path.relative(appRoot, routeFileAbsolutePath).replace(/\\/g, "/");
  const withoutRouteFile = relative.replace(/\/route\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/, "");
  const segments = withoutRouteFile.split("/").filter(Boolean);

  const pathSegments = segments.map((segment) => {
    if (segment.startsWith("[[...") && segment.endsWith("]]")) {
      return ":param";
    }

    if (segment.startsWith("[...") && segment.endsWith("]")) {
      return ":param";
    }

    if (segment.startsWith("[") && segment.endsWith("]")) {
      return `:${segment.slice(1, -1)}`;
    }

    return segment;
  });

  return normalizePathSegment(`/${pathSegments.join("/")}`);
}

function extractExportedHttpHandlers(unit: NodejsCompilationUnit): Array<{
  method: string;
  handler: SyntaxNode;
}> {
  const handlers: Array<{ method: string; handler: SyntaxNode }> = [];

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

      if (declaration.type === "function_declaration") {
        const nameNode = childByField(declaration, "name");
        const method = nameNode ? nodeText(nameNode, unit.source).toUpperCase() : undefined;
        if (method && HTTP_EXPORT_METHODS.has(method)) {
          handlers.push({ method, handler: declaration });
        }
        return;
      }

      for (const declarator of nodeChildren(declaration)) {
        if (declarator.type !== "variable_declarator") {
          continue;
        }

        const nameNode = childByField(declarator, "name");
        const valueNode = childByField(declarator, "value");
        if (!nameNode || !valueNode) {
          continue;
        }

        const method = nodeText(nameNode, unit.source).toUpperCase();
        if (HTTP_EXPORT_METHODS.has(method)) {
          handlers.push({ method, handler: valueNode });
        }
      }
    }
  });

  return handlers;
}

export function extractNextJsAppRouterRoutes(
  unit: NodejsCompilationUnit,
  routeFileAbsolutePath: string,
  appRoot: string,
  repositoryRelativePath: string,
): ParsedNextJsRouteFile | undefined {
  const routePath = convertNextJsSegmentsToPath(routeFileAbsolutePath, appRoot);
  const handlers = extractExportedHttpHandlers(unit);

  if (handlers.length === 0) {
    return undefined;
  }

  const endpoints = handlers.map((handler) => formatEndpoint(handler.method, routePath)).sort();
  const dtoTypes = new Set<string>();
  let tcpStackType: "BLOCKING" | "NON_BLOCKING" = "BLOCKING";

  for (const handler of handlers) {
    const parameters = nodeChildren(childByField(handler.handler, "parameters") ?? handler.handler).filter(
      (child) => child.type === "required_parameter" || child.type === "optional_parameter",
    );

    for (const dtoType of collectDtoTypesFromParameters(parameters, unit.source)) {
      dtoTypes.add(dtoType);
    }

    if (resolveTcpStackTypeFromHandler(handler.handler, unit.source) === "NON_BLOCKING") {
      tcpStackType = "NON_BLOCKING";
    }
  }

  return {
    routeFileRelativePath: repositoryRelativePath,
    endpoints: [...new Set(endpoints)],
    dtoTypes: [...dtoTypes].sort(),
    tcpStackType,
  };
}
