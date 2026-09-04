import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript/bindings/node/typescript.js";
import Tsx from "tree-sitter-typescript/bindings/node/tsx.js";

let typescriptParser: Parser | undefined;
let tsxParser: Parser | undefined;
let javascriptParser: Parser | undefined;

export function createTypeScriptParser(): Parser {
  if (!typescriptParser) {
    typescriptParser = new Parser();
    typescriptParser.setLanguage(TypeScript);
  }

  return typescriptParser;
}

export function createTsxParser(): Parser {
  if (!tsxParser) {
    tsxParser = new Parser();
    tsxParser.setLanguage(Tsx);
  }

  return tsxParser;
}

export function createJavaScriptParser(): Parser {
  if (!javascriptParser) {
    javascriptParser = new Parser();
    javascriptParser.setLanguage(JavaScript);
  }

  return javascriptParser;
}

export function createParserForFileName(fileName: string): Parser {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".tsx")) {
    return createTsxParser();
  }

  if (lower.endsWith(".ts") || lower.endsWith(".mts") || lower.endsWith(".cts")) {
    return createTypeScriptParser();
  }

  return createJavaScriptParser();
}

export function isNodejsSourceFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    (lower.endsWith(".ts") ||
      lower.endsWith(".tsx") ||
      lower.endsWith(".js") ||
      lower.endsWith(".jsx") ||
      lower.endsWith(".mts") ||
      lower.endsWith(".cts") ||
      lower.endsWith(".mjs") ||
      lower.endsWith(".cjs")) &&
    !lower.endsWith(".d.ts")
  );
}
