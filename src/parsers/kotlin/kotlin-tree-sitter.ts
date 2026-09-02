import Parser from "tree-sitter";
import Kotlin from "tree-sitter-kotlin";

let sharedParser: Parser | undefined;

export function createKotlinParser(): Parser {
  if (!sharedParser) {
    sharedParser = new Parser();
    sharedParser.setLanguage(Kotlin);
  }

  return sharedParser;
}
