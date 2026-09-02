import type { KotlinCompilationUnit } from "./kotlin-ast-model.js";
import { adaptKotlinCompilationUnitToJava } from "./kotlin-rest-source-adapter.js";
import {
  extractProgrammaticRestClients,
  type ParsedProgrammaticRestClient,
} from "../java/rest-client/programmatic-http-client-extractor.js";

export function extractKotlinProgrammaticRestClients(
  compilationUnit: KotlinCompilationUnit,
): ParsedProgrammaticRestClient[] {
  return extractProgrammaticRestClients(adaptKotlinCompilationUnitToJava(compilationUnit));
}
