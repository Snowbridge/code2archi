import Parser from "tree-sitter";
import Java from "tree-sitter-java";
import Kotlin from "tree-sitter-kotlin";

let javaParser: Parser | undefined;
let kotlinParser: Parser | undefined;

export function getJavaParser(): Parser {
  if (javaParser === undefined) {
    javaParser = new Parser();
    javaParser.setLanguage(Java);
  }
  return javaParser;
}

export function getKotlinParser(): Parser {
  if (kotlinParser === undefined) {
    kotlinParser = new Parser();
    kotlinParser.setLanguage(Kotlin);
  }
  return kotlinParser;
}

export function parseJvmSource(source: string, language: "java" | "kotlin"): Parser.Tree {
  if (language === "java") {
    return getJavaParser().parse(source);
  }
  return getKotlinParser().parse(source);
}
