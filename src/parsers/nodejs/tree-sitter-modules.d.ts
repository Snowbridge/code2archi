declare module "tree-sitter-typescript/bindings/node/typescript.js" {
  import type { Language } from "tree-sitter";

  const TypeScript: Language;
  export default TypeScript;
}

declare module "tree-sitter-typescript/bindings/node/tsx.js" {
  import type { Language } from "tree-sitter";

  const Tsx: Language;
  export default Tsx;
}

declare module "tree-sitter-javascript" {
  import type { Language } from "tree-sitter";

  const JavaScript: Language;
  export default JavaScript;
}
