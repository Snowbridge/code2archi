import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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

function extractQuotedPaths(content: string, includeKotlin: boolean): string[] {
  const paths: string[] = [];
  const patterns = [
    /srcDirs\s*\(\s*([^)]+)\)/g,
    /srcDir\s+(['"][^'"]+['"])/g,
    /srcDir\s*\(\s*(['"][^'"]+['"])\s*\)/g,
    /java\.srcDirs\s*\(\s*([^)]+)\)/g,
    /java\.srcDir\s*\(\s*(['"][^'"]+['"])\s*\)/g,
  ];

  if (includeKotlin) {
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

  const content = readFileSync(buildFilePath, "utf8");
  const extracted = extractQuotedPaths(content, false)
    .map((sourceDir) => normalizeSourceDir(moduleRoot, sourceDir))
    .filter((sourceDir): sourceDir is string => sourceDir !== undefined);

  const unique = [...new Set(extracted)];
  if (unique.length > 0) {
    return unique;
  }

  return existsSync(fallback) ? [fallback] : [];
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

  const content = readFileSync(buildFilePath, "utf8");
  const extracted = extractQuotedPaths(content, true)
    .map((sourceDir) => normalizeSourceDir(moduleRoot, sourceDir))
    .filter((sourceDir): sourceDir is string => sourceDir !== undefined);

  const unique = [...new Set(extracted)];
  if (unique.length > 0) {
    return unique;
  }

  return existsSync(fallback) ? [fallback] : [];
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
