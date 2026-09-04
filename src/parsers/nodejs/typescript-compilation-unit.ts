import { readFileSync } from "node:fs";
import path from "node:path";
import type { SyntaxNode } from "tree-sitter";
import { createParserForFileName } from "./nodejs-tree-sitter.js";

export interface NodejsCompilationUnit {
  readonly source: string;
  readonly root: SyntaxNode;
  readonly fileName: string;
}

export function parseNodejsSourceFile(source: string, fileName: string): NodejsCompilationUnit {
  const parser = createParserForFileName(fileName);
  const tree = parser.parse(source);

  return {
    source,
    root: tree.rootNode,
    fileName,
  };
}

export function parseNodejsSourceFileFromPath(absolutePath: string): NodejsCompilationUnit {
  const source = readFileSync(absolutePath, "utf8");
  return parseNodejsSourceFile(source, path.basename(absolutePath));
}
