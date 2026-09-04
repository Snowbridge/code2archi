import { readdirSync } from "node:fs";
import path from "node:path";
import type { SyntaxNode } from "tree-sitter";
import type { ApplicationModuleRecord } from "../../discovery-model/entities/application-module.js";
import type { RepositoryRecord } from "../../discovery-model/entities/repository.js";
import { recordProcessedFile } from "../../platform/profiling/index.js";
import { isNodejsSourceFileName } from "./nodejs-tree-sitter.js";
import {
  isExcludedNpmSourceFile,
  resolveNpmPackageRoot,
  resolveNpmProductionSourceRoots,
} from "./nodejs-source-roots.js";
import { childByField, nodeChildren, nodeText, walkNodes } from "./nodejs-tree-sitter-utils.js";
import type { NodejsCompilationUnit } from "./typescript-compilation-unit.js";

export interface NpmModuleSourceContext {
  readonly module: ApplicationModuleRecord;
  readonly repository: RepositoryRecord;
  readonly sourceRoots: readonly string[];
  readonly packageRoot: string;
}

export interface NodejsSourceFileContext {
  readonly absolutePath: string;
  readonly module: ApplicationModuleRecord;
  readonly repository: RepositoryRecord;
  readonly packageRoot: string;
}

const PRIMITIVE_TYPE_NAMES = new Set([
  "string",
  "number",
  "boolean",
  "void",
  "any",
  "unknown",
  "never",
  "null",
  "undefined",
  "object",
  "symbol",
  "bigint",
  "Date",
  "Buffer",
  "Request",
  "Response",
  "NextFunction",
]);

function walkNodejsFiles(rootDir: string, packageRoot: string): string[] {
  const files: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) {
      continue;
    }

    let entries;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!isExcludedNpmSourceFile(absolutePath, packageRoot)) {
          stack.push(absolutePath);
        }
        continue;
      }

      if (
        entry.isFile() &&
        isNodejsSourceFileName(entry.name) &&
        !isExcludedNpmSourceFile(absolutePath, packageRoot)
      ) {
        files.push(absolutePath);
      }
    }
  }

  return files;
}

export function collectNodejsSourceFiles(
  contexts: readonly NpmModuleSourceContext[],
): NodejsSourceFileContext[] {
  const fileToContext = new Map<string, NodejsSourceFileContext>();

  for (const context of contexts) {
    for (const sourceRoot of context.sourceRoots) {
      for (const absolutePath of walkNodejsFiles(sourceRoot, context.packageRoot)) {
        const existing = fileToContext.get(absolutePath);
        if (!existing) {
          recordProcessedFile(absolutePath);
          fileToContext.set(absolutePath, {
            absolutePath,
            module: context.module,
            repository: context.repository,
            packageRoot: context.packageRoot,
          });
          continue;
        }

        if (context.module.repoPath.length > existing.module.repoPath.length) {
          fileToContext.set(absolutePath, {
            absolutePath,
            module: context.module,
            repository: context.repository,
            packageRoot: context.packageRoot,
          });
        }
      }
    }
  }

  return [...fileToContext.values()].sort((left, right) =>
    left.absolutePath.localeCompare(right.absolutePath),
  );
}

export function collectNodejsRouteFiles(
  contexts: readonly NpmModuleSourceContext[],
  routeFileName: string,
): NodejsSourceFileContext[] {
  const matches: NodejsSourceFileContext[] = [];

  for (const context of contexts) {
    const appRoot = path.join(context.packageRoot, "app");
    for (const absolutePath of walkNodejsFiles(appRoot, context.packageRoot)) {
      if (path.basename(absolutePath) !== routeFileName) {
        continue;
      }

      recordProcessedFile(absolutePath);
      matches.push({
        absolutePath,
        module: context.module,
        repository: context.repository,
        packageRoot: context.packageRoot,
      });
    }
  }

  return matches.sort((left, right) => left.absolutePath.localeCompare(right.absolutePath));
}

function extractTypeName(typeNode: SyntaxNode, source: string): string | undefined {
  if (typeNode.type === "type_identifier" || typeNode.type === "identifier") {
    const name = nodeText(typeNode, source);
    return PRIMITIVE_TYPE_NAMES.has(name) ? undefined : name;
  }

  if (typeNode.type === "generic_type") {
    const nameNode = nodeChildren(typeNode)[0];
    return nameNode ? extractTypeName(nameNode, source) : undefined;
  }

  if (typeNode.type === "array_type") {
    const element = childByField(typeNode, "element") ?? nodeChildren(typeNode)[0];
    return element ? extractTypeName(element, source) : undefined;
  }

  if (typeNode.type === "union_type") {
    for (const child of nodeChildren(typeNode)) {
      const name = extractTypeName(child, source);
      if (name) {
        return name;
      }
    }
  }

  return undefined;
}

export function collectDtoTypesFromParameters(parameters: readonly SyntaxNode[], source: string): string[] {
  const dtoTypes = new Set<string>();

  for (const parameter of parameters) {
    const typeAnnotation =
      childByField(parameter, "type") ??
      findFirstTypeAnnotation(parameter);

    if (!typeAnnotation) {
      continue;
    }

    const typeName = extractTypeName(typeAnnotation, source);
    if (typeName) {
      dtoTypes.add(typeName);
    }
  }

  return [...dtoTypes].sort();
}

function findFirstTypeAnnotation(node: SyntaxNode): SyntaxNode | undefined {
  let found: SyntaxNode | undefined;

  walkNodes(node, (current) => {
    if (found) {
      return;
    }

    if (current.type === "type_annotation") {
      const inner = nodeChildren(current)[0];
      if (inner) {
        found = inner;
      }
    }
  });

  return found;
}

export function isAsyncHandler(node: SyntaxNode): boolean {
  if (node.type === "function_declaration" || node.type === "method_definition") {
    return node.text.startsWith("async ");
  }

  if (node.type === "arrow_function") {
    return node.text.startsWith("async ");
  }

  return false;
}

export function returnsPromiseType(node: SyntaxNode, source: string): boolean {
  const returnType = childByField(node, "return_type");
  if (!returnType) {
    return isAsyncHandler(node);
  }

  const inner = nodeChildren(returnType)[0];
  if (!inner) {
    return false;
  }

  if (inner.type === "generic_type") {
    const nameNode = nodeChildren(inner)[0];
    return nameNode ? nodeText(nameNode, source) === "Promise" : false;
  }

  return false;
}

export function resolveTcpStackTypeFromHandler(handlerNode: SyntaxNode, source: string): "BLOCKING" | "NON_BLOCKING" {
  return isAsyncHandler(handlerNode) || returnsPromiseType(handlerNode, source)
    ? "NON_BLOCKING"
    : "BLOCKING";
}
