import path from "node:path";
import type { SyntaxNode } from "tree-sitter";
import {
  parseJavaCompilationUnit,
} from "../../parsers/java/java-compilation-unit.js";
import type { JavaCompilationUnit } from "../../parsers/java/java-ast-model.js";
import {
  parseKotlinSourceFile,
  type ParseKotlinOptions,
} from "../../parsers/kotlin/kotlin-compilation-unit.js";
import type { KotlinCompilationUnit } from "../../parsers/kotlin/kotlin-ast-model.js";
import {
  parseNodejsSourceFile,
  type NodejsCompilationUnit,
} from "../../parsers/nodejs/typescript-compilation-unit.js";
import { getScanIoCacheState } from "./scan-io-cache.js";
import { recordScanIoCacheHit, recordScanIoCacheMiss } from "./scan-io-metrics.js";
import { readScanUtf8File } from "./scan-io-read.js";

function kotlinParseCacheKey(absolutePath: string, options?: ParseKotlinOptions): string {
  return `${absolutePath}:${options?.fileBaseName ?? ""}`;
}

export function parseScanJavaFile(absolutePath: string): JavaCompilationUnit {
  const cacheState = getScanIoCacheState();
  const options = cacheState.options;

  if (!options.enabled || !options.parseCacheEnabled || options.parseCacheJavaEntries === 0) {
    return parseJavaCompilationUnit(readScanUtf8File(absolutePath));
  }

  const cached = cacheState.javaParseCache.get(absolutePath) as JavaCompilationUnit | undefined;
  if (cached !== undefined) {
    recordScanIoCacheHit("parse.java");
    return cached;
  }

  recordScanIoCacheMiss("parse.java");
  const parsed = parseJavaCompilationUnit(readScanUtf8File(absolutePath));
  cacheState.javaParseCache.set(absolutePath, parsed);
  return parsed;
}

export function parseScanKotlinFile(
  absolutePath: string,
  parseOptions?: ParseKotlinOptions,
): KotlinCompilationUnit {
  const cacheState = getScanIoCacheState();
  const options = cacheState.options;
  const cacheKey = kotlinParseCacheKey(absolutePath, parseOptions);

  if (!options.enabled || !options.parseCacheEnabled || options.parseCacheKotlinEntries === 0) {
    const source = readScanUtf8File(absolutePath);
    return parseKotlinSourceFile(source, parseOptions ?? {});
  }

  const cached = cacheState.kotlinParseCache.get(cacheKey) as KotlinCompilationUnit | undefined;
  if (cached !== undefined) {
    recordScanIoCacheHit("parse.kotlin");
    return cached;
  }

  recordScanIoCacheMiss("parse.kotlin");
  const source = readScanUtf8File(absolutePath);
  const parsed = parseKotlinSourceFile(source, parseOptions ?? {});
  cacheState.kotlinParseCache.set(cacheKey, parsed);
  return parsed;
}

export function parseScanNodejsFile(absolutePath: string): NodejsCompilationUnit {
  const cacheState = getScanIoCacheState();
  const options = cacheState.options;

  if (!options.enabled || !options.parseCacheEnabled || options.parseCacheNodejsEntries === 0) {
    const source = readScanUtf8File(absolutePath);
    return parseNodejsSourceFile(source, path.basename(absolutePath));
  }

  const cached = cacheState.nodejsParseCache.get(absolutePath) as NodejsCompilationUnit | undefined;
  if (cached !== undefined) {
    recordScanIoCacheHit("parse.nodejs");
    return cached;
  }

  recordScanIoCacheMiss("parse.nodejs");
  const source = readScanUtf8File(absolutePath);
  const parsed = parseNodejsSourceFile(source, path.basename(absolutePath));
  cacheState.nodejsParseCache.set(absolutePath, parsed);
  return parsed;
}

export function parseScanNodejsSyntaxRoot(absolutePath: string): SyntaxNode {
  return parseScanNodejsFile(absolutePath).root;
}
