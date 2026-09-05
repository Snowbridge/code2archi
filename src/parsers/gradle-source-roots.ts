import { existsSync } from "node:fs";
import path from "node:path";
import { readScanUtf8File } from "../platform/scan-io/index.js";

const TEST_PATH_SEGMENT = /(^|[\\/])(test|it|integrationTest)([\\/]|$)/i;

function isTestSourcePath(sourcePath: string): boolean {
  const normalized = sourcePath.replace(/\\/g, "/");
  return TEST_PATH_SEGMENT.test(normalized);
}

function normalizeSourceDir(moduleRoot: string, sourceDir: string): string | undefined {
  const trimmed = sourceDir.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) {
    return undefined;
  }

  const absolute = path.isAbsolute(trimmed)
    ? path.resolve(trimmed)
    : path.resolve(moduleRoot, trimmed);
  const relative = path.relative(moduleRoot, absolute).replace(/\\/g, "/");

  if (isTestSourcePath(relative)) {
    return undefined;
  }

  return existsSync(absolute) ? absolute : undefined;
}

interface ExtractQuotedPathsOptions {
  readonly includeJava: boolean;
  readonly includeKotlin: boolean;
}

function extractQuotedPaths(content: string, options: ExtractQuotedPathsOptions): string[] {
  const paths: string[] = [];
  const patterns = [
    /(?<![.\w])srcDirs\s*\(\s*([^)]+)\)/g,
    /(?<![.\w])srcDir\s+(['"][^'"]+['"])/g,
    /(?<![.\w])srcDir\s*\(\s*(['"][^'"]+['"])\s*\)/g,
  ];

  if (options.includeJava) {
    patterns.push(
      /java\.srcDirs\s*\(\s*([^)]+)\)/g,
      /java\.srcDir\s*\(\s*(['"][^'"]+['"])\s*\)/g,
    );
  }

  if (options.includeKotlin) {
    patterns.push(
      /kotlin\.srcDirs\s*\(\s*([^)]+)\)/g,
      /kotlin\.srcDir\s*\(\s*(['"][^'"]+['"])\s*\)/g,
    );
  }

  for (const pattern of patterns) {
    let match: RegExpExecArray | null = pattern.exec(content);
    while (match) {
      const captured = match[1] ?? "";
      const quoted = [...captured.matchAll(/(['"])([^'"]+)\1/g)].map((entry) => entry[2] ?? "");
      if (quoted.length > 0) {
        paths.push(...quoted);
      } else if (captured.startsWith('"') || captured.startsWith("'")) {
        paths.push(captured.slice(1, -1));
      }
      match = pattern.exec(content);
    }
  }

  return paths;
}

function mergeWithFallbackSourceRoot(roots: readonly string[], fallback: string): string[] {
  const merged = new Set(roots);
  if (existsSync(fallback)) {
    merged.add(fallback);
  }
  return [...merged];
}

export function parseGradleProductionJavaSourceRoots(
  repoRoot: string,
  moduleRepoPath: string,
  buildScript: string,
): string[] {
  const moduleRoot = path.resolve(repoRoot, moduleRepoPath === "." ? "" : moduleRepoPath);
  const buildFilePath = path.resolve(repoRoot, buildScript);
  const fallback = path.join(moduleRoot, "src", "main", "java");

  if (!existsSync(buildFilePath)) {
    return existsSync(fallback) ? [fallback] : [];
  }

  const content = readScanUtf8File(buildFilePath);
  const extracted = extractQuotedPaths(content, { includeJava: true, includeKotlin: false })
    .map((sourceDir) => normalizeSourceDir(moduleRoot, sourceDir))
    .filter((sourceDir): sourceDir is string => sourceDir !== undefined);

  return mergeWithFallbackSourceRoot(extracted, fallback);
}

export function resolveMavenProductionJavaSourceRoot(
  repoRoot: string,
  moduleRepoPath: string,
): string | undefined {
  const sourceRoot = path.join(
    repoRoot,
    moduleRepoPath === "." ? "" : moduleRepoPath,
    "src",
    "main",
    "java",
  );
  return existsSync(sourceRoot) ? path.resolve(sourceRoot) : undefined;
}

export function parseGradleProductionKotlinSourceRoots(
  repoRoot: string,
  moduleRepoPath: string,
  buildScript: string,
): string[] {
  const moduleRoot = path.resolve(repoRoot, moduleRepoPath === "." ? "" : moduleRepoPath);
  const buildFilePath = path.resolve(repoRoot, buildScript);
  const fallback = path.join(moduleRoot, "src", "main", "kotlin");

  if (!existsSync(buildFilePath)) {
    return existsSync(fallback) ? [fallback] : [];
  }

  const content = readScanUtf8File(buildFilePath);
  const extracted = extractQuotedPaths(content, { includeJava: false, includeKotlin: true })
    .map((sourceDir) => normalizeSourceDir(moduleRoot, sourceDir))
    .filter((sourceDir): sourceDir is string => sourceDir !== undefined);

  return mergeWithFallbackSourceRoot(extracted, fallback);
}

export function resolveMavenProductionKotlinSourceRoot(
  repoRoot: string,
  moduleRepoPath: string,
): string | undefined {
  const sourceRoot = path.join(
    repoRoot,
    moduleRepoPath === "." ? "" : moduleRepoPath,
    "src",
    "main",
    "kotlin",
  );
  return existsSync(sourceRoot) ? path.resolve(sourceRoot) : undefined;
}
