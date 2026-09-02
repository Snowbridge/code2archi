import { getAnnotationAttribute } from "../java-annotation-utils.js";
import type { JavaCompilationUnit } from "../java-ast-model.js";
import { parseJavaSourceFile } from "../java-compilation-unit.js";
import type { KotlinCompilationUnit } from "../../kotlin/kotlin-ast-model.js";
import { parseKotlinSourceFile } from "../../kotlin/kotlin-compilation-unit.js";
import { adaptKotlinCompilationUnitToJava } from "../../kotlin/kotlin-rest-source-adapter.js";
import { extractKotlinProgrammaticRestClients } from "../../kotlin/kotlin-programmatic-rest-client-adapter.js";
import {
  extractRestClientsForModule,
  type ParsedRestClient,
} from "./rest-client-extractor.js";
import {
  extractProgrammaticRestClients,
  type ParsedProgrammaticRestClient,
} from "./programmatic-http-client-extractor.js";

export type { ParsedRestClient, ParsedProgrammaticRestClient };

export function readFeignServiceName(
  annotations: readonly { readonly name: string; readonly qualifiedName: string; readonly attributes: Readonly<Record<string, string | readonly string[]>> }[],
): string | undefined {
  const feignAnnotation = annotations.find(
    (annotation) =>
      annotation.name === "FeignClient" ||
      annotation.qualifiedName === "org.springframework.cloud.openfeign.FeignClient",
  );
  if (!feignAnnotation) {
    return undefined;
  }
  const nameAttr =
    getAnnotationAttribute(feignAnnotation, "name") ??
    getAnnotationAttribute(feignAnnotation, "value");
  return typeof nameAttr === "string" && nameAttr.length > 0 ? nameAttr : undefined;
}

export function parseJavaCompilationUnits(
  sources: ReadonlyMap<string, string>,
): JavaCompilationUnit[] {
  const units: JavaCompilationUnit[] = [];
  for (const source of sources.values()) {
    try {
      units.push(parseJavaSourceFile(source));
    } catch {
      continue;
    }
  }
  return units;
}

export function parseKotlinCompilationUnits(
  sources: ReadonlyMap<string, string>,
): KotlinCompilationUnit[] {
  const units: KotlinCompilationUnit[] = [];
  for (const source of sources.values()) {
    try {
      units.push(parseKotlinSourceFile(source));
    } catch {
      continue;
    }
  }
  return units;
}

export function extractDeclarativeRestClientsFromJavaSources(
  sources: ReadonlyMap<string, string>,
): ParsedRestClient[] {
  return extractRestClientsForModule(parseJavaCompilationUnits(sources));
}

export function extractDeclarativeRestClientsFromKotlinSources(
  sources: ReadonlyMap<string, string>,
): ParsedRestClient[] {
  const javaUnits = parseKotlinCompilationUnits(sources).map((unit) =>
    adaptKotlinCompilationUnitToJava(unit),
  );
  return extractRestClientsForModule(javaUnits);
}

export function extractProgrammaticRestClientsFromJavaSources(
  sources: ReadonlyMap<string, string>,
): ParsedProgrammaticRestClient[] {
  const clients: ParsedProgrammaticRestClient[] = [];
  for (const unit of parseJavaCompilationUnits(sources)) {
    clients.push(...extractProgrammaticRestClients(unit));
  }
  return clients;
}

export function extractProgrammaticRestClientsFromKotlinSources(
  sources: ReadonlyMap<string, string>,
): ParsedProgrammaticRestClient[] {
  const clients: ParsedProgrammaticRestClient[] = [];
  for (const unit of parseKotlinCompilationUnits(sources)) {
    clients.push(...extractKotlinProgrammaticRestClients(unit));
  }
  return clients;
}
