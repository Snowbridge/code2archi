import type { JvmImportContext } from "./types.js";
import { resolveJvmFqcn } from "./resolve-jvm-fqcn.js";

export function resolveKotlinFqcn(literalName: string, context: JvmImportContext): string {
  return resolveJvmFqcn(literalName, context, { implicitJavaLang: false });
}
