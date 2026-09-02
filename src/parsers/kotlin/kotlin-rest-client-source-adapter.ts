import type { KotlinCompilationUnit } from "./kotlin-ast-model.js";
import {
  adaptKotlinCompilationUnitToJava,
} from "./kotlin-rest-source-adapter.js";
import {
  extractRestClientsForModule,
  type ParsedRestClient,
} from "../java/rest-client/rest-client-extractor.js";

export function extractKotlinRestClients(compilationUnit: KotlinCompilationUnit): ParsedRestClient[] {
  return extractRestClientsForModule([adaptKotlinCompilationUnitToJava(compilationUnit)]);
}
