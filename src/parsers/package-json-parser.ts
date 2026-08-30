import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { mergeNpmChildVersions, parseNpmBuildVersions } from "./build-tool-versions.js";
import { parseNpmName } from "./npm-name.js";

export interface NpmModuleParseResult {
  readonly name: string;
  readonly groupId: string;
  readonly artifactId: string;
  readonly version: string;
  readonly buildScript: string;
  readonly repoPath: string;
  readonly parentName?: string;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly isMultimodule: boolean;
  readonly buildToolVersion: string;
  readonly javaVersion: string;
  readonly kotlinJvmTarget: string;
  readonly kotlinCompilerVersion: string;
  readonly nodeVersion: string;
}

export function parseNpmRepository(
  repoRoot: string,
  rootPackageRelativePath = "package.json",
): NpmModuleParseResult[] {
  const rootAbsolutePath = path.join(repoRoot, rootPackageRelativePath);
  if (!existsSync(rootAbsolutePath)) {
    return [];
  }

  const rootPackage = readPackageJson(rootAbsolutePath);
  if (!rootPackage) {
    return [];
  }

  const rootName = typeof rootPackage.name === "string" ? rootPackage.name : undefined;
  if (!rootName) {
    return [];
  }

  const workspacePatterns = extractWorkspacePatterns(rootPackage.workspaces);
  const isMultimodule = workspacePatterns.length > 0;
  const results: NpmModuleParseResult[] = [];

  const rootBuildScript = rootPackageRelativePath.replace(/\\/g, "/");
  const rootParts = parseNpmName(rootName);

  const rootBuildVersions = parseNpmBuildVersions(rootPackage);

  results.push({
    name: rootName,
    groupId: rootParts.groupId,
    artifactId: rootParts.artifactId,
    version: typeof rootPackage.version === "string" ? rootPackage.version : "",
    buildScript: rootBuildScript,
    repoPath: posixDirname(rootBuildScript),
    dependencies: readDependencies(rootPackage),
    isMultimodule,
    ...rootBuildVersions,
  });

  if (!isMultimodule) {
    return results;
  }

  const childPackagePaths = resolveWorkspacePackagePaths(repoRoot, workspacePatterns);
  for (const packageRelativePath of childPackagePaths) {
    const absolutePath = path.join(repoRoot, packageRelativePath);
    const pkg = readPackageJson(absolutePath);
    if (!pkg || typeof pkg.name !== "string") {
      continue;
    }

    const parts = parseNpmName(pkg.name);
    const normalizedPath = packageRelativePath.replace(/\\/g, "/");
    const childBuildVersions = mergeNpmChildVersions(pkg, rootPackage);
    results.push({
      name: pkg.name,
      groupId: parts.groupId,
      artifactId: parts.artifactId,
      version: typeof pkg.version === "string" ? pkg.version : "",
      buildScript: normalizedPath,
      repoPath: posixDirname(normalizedPath),
      parentName: rootName,
      dependencies: readDependencies(pkg),
      isMultimodule: false,
      ...childBuildVersions,
    });
  }

  return results;
}

function readPackageJson(absolutePath: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function extractWorkspacePatterns(workspaces: unknown): string[] {
  if (Array.isArray(workspaces)) {
    return workspaces.filter((value): value is string => typeof value === "string");
  }

  if (workspaces && typeof workspaces === "object" && Array.isArray((workspaces as { packages?: unknown }).packages)) {
    return (workspaces as { packages: unknown[] }).packages.filter(
      (value): value is string => typeof value === "string",
    );
  }

  return [];
}

function resolveWorkspacePackagePaths(repoRoot: string, patterns: readonly string[]): string[] {
  const packagePaths = new Set<string>();

  for (const pattern of patterns) {
    const normalizedPattern = pattern.replace(/\\/g, "/");
    if (normalizedPattern.includes("*")) {
      expandGlobPattern(repoRoot, normalizedPattern).forEach((value) => packagePaths.add(value));
      continue;
    }

    const candidate = path.posix.join(normalizedPattern, "package.json");
    if (existsSync(path.join(repoRoot, candidate))) {
      packagePaths.add(candidate);
    }
  }

  return [...packagePaths].sort();
}

function expandGlobPattern(repoRoot: string, pattern: string): string[] {
  const wildcardIndex = pattern.indexOf("*");
  if (wildcardIndex === -1) {
    return [];
  }

  const baseDir = pattern.slice(0, wildcardIndex).replace(/\/$/, "");
  const absoluteBaseDir = path.join(repoRoot, baseDir);
  if (!existsSync(absoluteBaseDir)) {
    return [];
  }

  const suffix = pattern.slice(wildcardIndex + 1).replace(/^\//, "");
  const entries = readdirSync(absoluteBaseDir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageRelativePath = path.posix.join(baseDir, entry.name, suffix, "package.json");
    if (existsSync(path.join(repoRoot, packageRelativePath))) {
      results.push(packageRelativePath);
    }
  }

  return results;
}

function readDependencies(pkg: Record<string, unknown>): Record<string, string> {
  const dependencies = pkg.dependencies;
  if (!dependencies || typeof dependencies !== "object") {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [name, version] of Object.entries(dependencies as Record<string, unknown>)) {
    if (typeof version === "string") {
      result[name] = version;
    }
  }

  return result;
}

function posixDirname(filePath: string): string {
  const index = filePath.lastIndexOf("/");
  if (index <= 0) {
    return ".";
  }

  return filePath.slice(0, index);
}
