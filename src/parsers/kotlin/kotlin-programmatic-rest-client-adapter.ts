import type { KotlinCompilationUnit } from "./kotlin-ast-model.js";
import { extractKotlinProgrammaticRestClients } from "./kotlin-programmatic-rest-client-extractor.js";

export { extractKotlinProgrammaticRestClients };
export type { ParsedProgrammaticRestClient } from "../java/rest-client/programmatic-http-client-extractor.js";

export function extractKotlinProgrammaticRestClientsFromUnit(
  compilationUnit: KotlinCompilationUnit,
): ReturnType<typeof extractKotlinProgrammaticRestClients> {
  return extractKotlinProgrammaticRestClients(compilationUnit);
}
