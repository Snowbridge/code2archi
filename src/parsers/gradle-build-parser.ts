import { existsSync } from "node:fs";
import path from "node:path";
import { readProcessedUtf8File } from "../platform/profiling/helpers.js";

import { mergeGradleModuleVersions } from "./build-tool-versions.js";

export interface GradleCoordinates {
  readonly groupId: string;
  readonly artifactId: string;
  readonly version: string;
}

export interface GradleDependency extends GradleCoordinates {}

export interface GradleModuleParseResult {
  readonly coordinates: GradleCoordinates;
  readonly buildScript: string;
  readonly repoPath: string;
  readonly parentCoordinates?: GradleCoordinates;
  readonly childModulePaths: readonly string[];
  readonly dependencies: readonly GradleDependency[];
  readonly isMultimodule: boolean;
  readonly buildToolVersion: string;
  readonly javaVersion: string;
  readonly kotlinJvmTarget: string;
  readonly kotlinCompilerVersion: string;
  readonly nodeVersion: string;
  readonly typescriptVersion: string;
  readonly tsxVersion: string;
}

const GRADLE_APPLICATION_CONFIGURATIONS = ["api", "implementation", "compile"] as const;
const GRADLE_APPLICATION_CONFIGURATION_PATTERN =
  GRADLE_APPLICATION_CONFIGURATIONS.join("|");
const SETTINGS_FILES = ["settings.gradle.kts", "settings.gradle"] as const;
const BUILD_FILES = ["build.gradle.kts", "build.gradle"] as const;

export function parseGradleRepository(repoRoot: string): GradleModuleParseResult[] {
  const settingsFile = findFirstExisting(repoRoot, SETTINGS_FILES);
  const rootBuildFile = findFirstExisting(repoRoot, BUILD_FILES);
  if (!settingsFile && !rootBuildFile) {
    return [];
  }

  const settingsContent = settingsFile
    ? readProcessedUtf8File(path.join(repoRoot, settingsFile))
    : undefined;

  const rootProjectName = settingsContent
    ? parseRootProjectName(settingsContent, path.basename(repoRoot))
    : path.basename(repoRoot);

  const rootIncludes = [
    ...(settingsContent ? parseIncludes(settingsContent) : []),
    ...(rootBuildFile ? parseIncludes(readProcessedUtf8File(path.join(repoRoot, rootBuildFile))) : []),
  ];

  const uniqueIncludes = [...new Set(rootIncludes)];
  const results: GradleModuleParseResult[] = [];
  const visited = new Set<string>();

  function visitModule(
    modulePath: string,
    buildFileName: string,
    parentCoordinates?: GradleCoordinates,
  ): void {
    const buildScript = modulePath === "." ? buildFileName : path.posix.join(modulePath, buildFileName);
    if (visited.has(buildScript)) {
      return;
    }
    visited.add(buildScript);

    const absoluteBuildScript = path.join(repoRoot, buildScript);
    if (!existsSync(absoluteBuildScript)) {
      return;
    }

    const content = readProcessedUtf8File(absoluteBuildScript);
    const coordinates = parseCoordinates(content, modulePath === "." ? rootProjectName : path.posix.basename(modulePath));
    const buildVersions = mergeGradleModuleVersions(repoRoot, content, {
      settingsContent,
      modulePath: modulePath === "." ? "." : modulePath,
    });
    const includesInFile = parseIncludes(content);
    const includes =
      modulePath === "." ? [...new Set([...includesInFile, ...uniqueIncludes])] : includesInFile;
    const childModulePaths = includes.map((includePath) => normalizeIncludePath(includePath));

    results.push({
      coordinates,
      buildScript: buildScript.replace(/\\/g, "/"),
      repoPath: modulePath === "." ? "." : modulePath,
      parentCoordinates,
      childModulePaths,
      dependencies: parseApplicationDependencies(content),
      isMultimodule: includes.length > 0,
      ...buildVersions,
    });

    for (const childModulePath of childModulePaths) {
      const childBuildFile =
        findFirstExisting(path.join(repoRoot, childModulePath), BUILD_FILES) ?? "build.gradle";
      visitModule(childModulePath, childBuildFile, coordinates);
    }
  }

  const rootBuildFileName = rootBuildFile ?? "build.gradle";
  visitModule(".", rootBuildFileName);

  if (uniqueIncludes.length > 0) {
    for (const includePath of uniqueIncludes) {
      const childModulePath = normalizeIncludePath(includePath);
      if (results.some((result) => result.repoPath === childModulePath)) {
        continue;
      }

      const childBuildFile =
        findFirstExisting(path.join(repoRoot, childModulePath), BUILD_FILES) ?? "build.gradle";
      const rootCoordinates = results[0]?.coordinates;
      visitModule(childModulePath, childBuildFile, rootCoordinates);
    }
  }

  return results;
}

function findFirstExisting(
  directory: string,
  fileNames: readonly string[],
): string | undefined {
  for (const fileName of fileNames) {
    const candidate = path.join(directory, fileName);
    if (existsSync(candidate)) {
      return fileName;
    }
  }

  return undefined;
}

function parseRootProjectName(content: string, fallbackName: string): string {
  const match = content.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/);
  return match?.[1] ?? fallbackName;
}

function parseIncludes(content: string): string[] {
  const includes = new Set<string>();

  const callPattern = /include\s*\(([^)]*)\)/g;
  let callMatch: RegExpExecArray | null;
  while ((callMatch = callPattern.exec(content)) !== null) {
    for (const value of extractQuotedStrings(callMatch[1] ?? "")) {
      includes.add(normalizeIncludeToken(value));
    }
  }

  const singlePattern = /include\s+['"]([^'"]+)['"]/g;
  let singleMatch: RegExpExecArray | null;
  while ((singleMatch = singlePattern.exec(content)) !== null) {
    includes.add(normalizeIncludeToken(singleMatch[1] ?? ""));
  }

  return [...includes];
}

function parseCoordinates(content: string, fallbackArtifactId: string): GradleCoordinates {
  const groupMatch = content.match(/(?:^|\n)\s*group\s*=?\s*['"]([^'"]+)['"]/m);
  const versionMatch = content.match(/(?:^|\n)\s*version\s*=?\s*['"]([^'"]+)['"]/m);

  return {
    groupId: groupMatch?.[1] ?? "",
    artifactId: fallbackArtifactId,
    version: versionMatch?.[1] ?? "",
  };
}

function parseApplicationDependencies(content: string): GradleDependency[] {
  const dependencies: GradleDependency[] = [];

  const shortPattern = new RegExp(
    `(?:${GRADLE_APPLICATION_CONFIGURATION_PATTERN})\\s*\\(?\\s*['"]([^:'"]+):([^:'"]+):([^'"]+)['"]\\s*\\)?`,
    "g",
  );
  let shortMatch: RegExpExecArray | null;
  while ((shortMatch = shortPattern.exec(content)) !== null) {
    dependencies.push({
      groupId: shortMatch[1] ?? "",
      artifactId: shortMatch[2] ?? "",
      version: shortMatch[3] ?? "",
    });
  }

  const mapPattern = new RegExp(
    `(?:${GRADLE_APPLICATION_CONFIGURATION_PATTERN})\\s+group:\\s*['"]([^'"]+)['"],\\s*name:\\s*['"]([^'"]+)['"],\\s*version:\\s*['"]([^'"]+)['"]`,
    "g",
  );
  let mapMatch: RegExpExecArray | null;
  while ((mapMatch = mapPattern.exec(content)) !== null) {
    dependencies.push({
      groupId: mapMatch[1] ?? "",
      artifactId: mapMatch[2] ?? "",
      version: mapMatch[3] ?? "",
    });
  }

  return dependencies;
}

function extractQuotedStrings(fragment: string): string[] {
  const pattern = /['"]([^'"]+)['"]/g;
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(fragment)) !== null) {
    values.push(match[1] ?? "");
  }

  return values;
}

function normalizeIncludeToken(value: string): string {
  return value.replace(/^:/, "").replace(/:/g, "/");
}

function normalizeIncludePath(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "");
}
