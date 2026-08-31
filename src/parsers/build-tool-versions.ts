import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const UNKNOWN_VERSION = "unknown";

export const MODULE_VERSION_FIELDS = [
  "buildToolVersion",
  "javaVersion",
  "kotlinJvmTarget",
  "kotlinCompilerVersion",
  "nodeVersion",
  "typescriptVersion",
  "tsxVersion",
] as const;

export type ModuleVersionField = (typeof MODULE_VERSION_FIELDS)[number];

export interface ModuleBuildVersions {
  readonly buildToolVersion: string;
  readonly javaVersion: string;
  readonly kotlinJvmTarget: string;
  readonly kotlinCompilerVersion: string;
  readonly nodeVersion: string;
  readonly typescriptVersion: string;
  readonly tsxVersion: string;
}

export function unknownBuildVersions(): ModuleBuildVersions {
  return {
    buildToolVersion: UNKNOWN_VERSION,
    javaVersion: UNKNOWN_VERSION,
    kotlinJvmTarget: UNKNOWN_VERSION,
    kotlinCompilerVersion: UNKNOWN_VERSION,
    nodeVersion: UNKNOWN_VERSION,
    typescriptVersion: UNKNOWN_VERSION,
    tsxVersion: UNKNOWN_VERSION,
  };
}

export function readGradleWrapperVersion(repoRoot: string): string {
  return readWrapperDistributionVersion(repoRoot, "gradle/wrapper/gradle-wrapper.properties");
}

export function readMavenWrapperVersion(repoRoot: string): string {
  return readWrapperDistributionVersion(repoRoot, ".mvn/wrapper/maven-wrapper.properties");
}

function readWrapperDistributionVersion(repoRoot: string, relativePath: string): string {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    return UNKNOWN_VERSION;
  }

  const content = readFileSync(absolutePath, "utf8");
  const distributionMatch = content.match(
    /distributionUrl=.*?(?:gradle|apache-maven)-([0-9][0-9.]*)/,
  );
  return distributionMatch?.[1] ?? UNKNOWN_VERSION;
}

const GRADLE_JAVA_VERSION_PROPERTY_KEYS = ["versionJava", "javaVersion", "java.version"] as const;

export interface MergeGradleModuleVersionsOptions {
  readonly settingsContent?: string;
  readonly modulePath?: string;
}

export function parseGradleProperties(content: string): Record<string, string> {
  const properties: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("!")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    if (key !== "") {
      properties[key] = value;
    }
  }

  return properties;
}

export function readGradleProperties(repoRoot: string, modulePath = "."): Record<string, string> {
  let merged: Record<string, string> = {};

  const rootPropertiesPath = path.join(repoRoot, "gradle.properties");
  if (existsSync(rootPropertiesPath)) {
    merged = {
      ...parseGradleProperties(readFileSync(rootPropertiesPath, "utf8")),
    };
  }

  if (modulePath !== ".") {
    const modulePropertiesPath = path.join(repoRoot, modulePath, "gradle.properties");
    if (existsSync(modulePropertiesPath)) {
      merged = {
        ...merged,
        ...parseGradleProperties(readFileSync(modulePropertiesPath, "utf8")),
      };
    }
  }

  return merged;
}

export function resolveGradleProperty(
  name: string,
  properties: Readonly<Record<string, string>>,
): string | undefined {
  const value = properties[name];
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  return value.trim();
}

export function parseGradleBuildVersions(content: string): ModuleBuildVersions {
  return resolveGradleModuleVersions(content, {}, "");
}

export function mergeGradleModuleVersions(
  repoRoot: string,
  buildFileContent: string,
  options?: MergeGradleModuleVersionsOptions,
): ModuleBuildVersions {
  const modulePath = options?.modulePath ?? ".";
  const properties = readGradleProperties(repoRoot, modulePath);
  const fromBuild = resolveGradleModuleVersions(
    buildFileContent,
    properties,
    options?.settingsContent ?? "",
  );
  const wrapperVersion = readGradleWrapperVersion(repoRoot);
  return {
    ...fromBuild,
    buildToolVersion: wrapperVersion !== UNKNOWN_VERSION ? wrapperVersion : fromBuild.buildToolVersion,
  };
}

function resolveGradleModuleVersions(
  buildFileContent: string,
  properties: Readonly<Record<string, string>>,
  settingsContent: string,
): ModuleBuildVersions {
  const kotlinJvmTarget = parseGradleKotlinJvmTarget(buildFileContent, properties);
  const javaFromBuild = parseGradleJavaVersion(buildFileContent, properties);
  const kotlinCompilerVersion = parseGradleKotlinCompilerVersion(
    buildFileContent,
    settingsContent,
    properties,
  );
  const javaVersion =
    firstNonUnknown(
      javaFromBuild !== UNKNOWN_VERSION ? javaFromBuild : undefined,
      kotlinJvmTarget !== UNKNOWN_VERSION ? kotlinJvmTarget : undefined,
      ...GRADLE_JAVA_VERSION_PROPERTY_KEYS.map((key) => resolveGradleProperty(key, properties)),
    ) ?? UNKNOWN_VERSION;

  return {
    buildToolVersion: UNKNOWN_VERSION,
    javaVersion,
    kotlinJvmTarget,
    kotlinCompilerVersion,
    nodeVersion: UNKNOWN_VERSION,
    typescriptVersion: UNKNOWN_VERSION,
    tsxVersion: UNKNOWN_VERSION,
  };
}

function parseGradleJavaVersion(
  content: string,
  properties: Readonly<Record<string, string>> = {},
): string {
  const toolchainLiteralMatch = content.match(/languageVersion\s*=\s*JavaLanguageVersion\.of\((\d+)\)/);
  if (toolchainLiteralMatch?.[1]) {
    return toolchainLiteralMatch[1];
  }

  const toolchainRefMatch = content.match(
    /languageVersion\s*=\s*JavaLanguageVersion\.of\(([A-Za-z_][A-Za-z0-9_]*)\)/,
  );
  if (toolchainRefMatch?.[1]) {
    const resolved = resolveGradleProperty(toolchainRefMatch[1], properties);
    if (resolved) {
      return resolved;
    }
  }

  const compatibilityVersion = parseGradleJavaCompatibility(content, properties);
  if (compatibilityVersion !== UNKNOWN_VERSION) {
    return compatibilityVersion;
  }

  return UNKNOWN_VERSION;
}

function parseGradleJavaCompatibility(
  content: string,
  properties: Readonly<Record<string, string>>,
): string {
  for (const field of ["sourceCompatibility", "targetCompatibility"] as const) {
    const literalPattern = new RegExp(
      `${field}\\s*=\\s*(?:JavaVersion\\.)?VERSION_(\\d+)(?:_(?:\\d+))?|${field}\\s*=\\s*['"](\\d+(?:\\.\\d+)?)['"]`,
    );
    const literalMatch = content.match(literalPattern);
    const literalVersion = literalMatch?.[1] ?? literalMatch?.[2];
    if (literalVersion) {
      return literalVersion;
    }

    const refPattern = new RegExp(`${field}\\s*=\\s*([A-Za-z_][A-Za-z0-9_]*)`);
    const refMatch = content.match(refPattern);
    if (refMatch?.[1]) {
      const resolved = resolveGradleProperty(refMatch[1], properties);
      if (resolved) {
        return resolved;
      }
    }
  }

  return UNKNOWN_VERSION;
}

function parseGradleKotlinJvmTarget(
  content: string,
  properties: Readonly<Record<string, string>> = {},
): string {
  const literalMatch = content.match(/jvmTarget\s*=\s*['"](\d+(?:\.\d+)?)['"]/);
  if (literalMatch?.[1]) {
    return literalMatch[1];
  }

  const refMatch = content.match(/jvmTarget\s*=\s*([A-Za-z_][A-Za-z0-9_]*)/);
  if (refMatch?.[1]) {
    const resolved = resolveGradleProperty(refMatch[1], properties);
    if (resolved) {
      return resolved;
    }
  }

  return UNKNOWN_VERSION;
}

function parseGradleKotlinCompilerVersion(
  buildFileContent: string,
  settingsContent: string,
  properties: Readonly<Record<string, string>> = {},
): string {
  const fromBuild = parseGradleKotlinCompilerVersionFromContent(buildFileContent, properties);
  if (fromBuild !== UNKNOWN_VERSION) {
    return fromBuild;
  }

  return parseGradleKotlinCompilerVersionFromContent(settingsContent, properties);
}

function parseGradleKotlinCompilerVersionFromContent(
  content: string,
  properties: Readonly<Record<string, string>>,
): string {
  const pluginLiteralMatch = content.match(
    /(?:id|kotlin)\s*\(\s*['"]org\.jetbrains\.kotlin\.(?:jvm|multiplatform|android)['"]\s*\)\s*version\s*['"]([^'"]+)['"]/,
  );
  if (pluginLiteralMatch?.[1]) {
    return pluginLiteralMatch[1];
  }

  const pluginRefMatch = content.match(
    /(?:id|kotlin)\s*\(\s*['"]org\.jetbrains\.kotlin\.(?:jvm|multiplatform|android)['"]\s*\)\s*version\s+([A-Za-z_][A-Za-z0-9_]*)/,
  );
  if (pluginRefMatch?.[1]) {
    const resolved = resolveGradleProperty(pluginRefMatch[1], properties);
    if (resolved) {
      return resolved;
    }
  }

  const kotlinJvmLiteralMatch = content.match(/kotlin\s*\(\s*['"]jvm['"]\s*\)\s*version\s*['"]([^'"]+)['"]/);
  if (kotlinJvmLiteralMatch?.[1]) {
    return kotlinJvmLiteralMatch[1];
  }

  const kotlinJvmRefMatch = content.match(
    /kotlin\s*\(\s*['"]jvm['"]\s*\)\s*version\s+([A-Za-z_][A-Za-z0-9_]*)/,
  );
  if (kotlinJvmRefMatch?.[1]) {
    const resolved = resolveGradleProperty(kotlinJvmRefMatch[1], properties);
    if (resolved) {
      return resolved;
    }
  }

  const classpathMatch = content.match(/org\.jetbrains\.kotlin:kotlin-gradle-plugin:([^'"\s]+)/);
  return classpathMatch?.[1] ?? UNKNOWN_VERSION;
}

export function parseMavenBuildVersions(
  properties: Readonly<Record<string, string>>,
  pomContent: string,
): ModuleBuildVersions {
  const javaVersion =
    firstNonUnknown(
      properties["java.version"],
      properties["maven.compiler.release"],
      properties["maven.compiler.source"],
      properties["maven.compiler.target"],
      parseMavenCompilerPluginVersion(pomContent, "source"),
      parseMavenCompilerPluginVersion(pomContent, "target"),
    ) ?? UNKNOWN_VERSION;

  const kotlinJvmTarget =
    firstNonUnknown(properties["kotlin.compiler.jvmTarget"], properties["kotlin.jvm.target"]) ??
    UNKNOWN_VERSION;

  const kotlinCompilerVersion =
    firstNonUnknown(properties["kotlin.version"], parseMavenKotlinPluginVersion(pomContent)) ??
    UNKNOWN_VERSION;

  return {
    buildToolVersion: UNKNOWN_VERSION,
    javaVersion,
    kotlinJvmTarget,
    kotlinCompilerVersion,
    nodeVersion: UNKNOWN_VERSION,
    typescriptVersion: UNKNOWN_VERSION,
    tsxVersion: UNKNOWN_VERSION,
  };
}

export function mergeMavenModuleVersions(
  repoRoot: string,
  properties: Readonly<Record<string, string>>,
  pomContent: string,
): ModuleBuildVersions {
  const fromPom = parseMavenBuildVersions(properties, pomContent);
  const wrapperVersion = readMavenWrapperVersion(repoRoot);
  return {
    ...fromPom,
    buildToolVersion: wrapperVersion !== UNKNOWN_VERSION ? wrapperVersion : fromPom.buildToolVersion,
  };
}

function parseMavenCompilerPluginVersion(
  pomContent: string,
  field: "source" | "target",
): string | undefined {
  const pluginBlock = pomContent.match(
    /<artifactId>maven-compiler-plugin<\/artifactId>[\s\S]*?<configuration>([\s\S]*?)<\/configuration>/,
  );
  if (!pluginBlock?.[1]) {
    return undefined;
  }

  const fieldMatch = pluginBlock[1].match(new RegExp(`<${field}>([^<]+)</${field}>`));
  return fieldMatch?.[1]?.trim();
}

function parseMavenKotlinPluginVersion(pomContent: string): string | undefined {
  const pluginMatch = pomContent.match(
    /<artifactId>kotlin-maven-plugin<\/artifactId>[\s\S]*?<version>([^<]+)<\/version>/,
  );
  return pluginMatch?.[1]?.trim();
}

export function parseNpmBuildVersions(pkg: Record<string, unknown>): ModuleBuildVersions {
  const engines = readEngines(pkg);
  const packageManager = typeof pkg.packageManager === "string" ? pkg.packageManager : undefined;
  const buildToolVersion = parseNpmToolVersion(packageManager, engines.npm);

  return {
    buildToolVersion,
    javaVersion: UNKNOWN_VERSION,
    kotlinJvmTarget: UNKNOWN_VERSION,
    kotlinCompilerVersion: UNKNOWN_VERSION,
    nodeVersion: engines.node ?? UNKNOWN_VERSION,
    typescriptVersion: readNpmPackageVersion(pkg, "typescript"),
    tsxVersion: readNpmPackageVersion(pkg, "tsx"),
  };
}

function readEngines(pkg: Record<string, unknown>): { readonly node?: string; readonly npm?: string } {
  const engines = pkg.engines;
  if (!engines || typeof engines !== "object") {
    return {};
  }

  const record = engines as Record<string, unknown>;
  return {
    ...(typeof record.node === "string" ? { node: record.node } : {}),
    ...(typeof record.npm === "string" ? { npm: record.npm } : {}),
  };
}

function readNpmPackageVersion(pkg: Record<string, unknown>, packageName: string): string {
  const devDependencies = readDependencySection(pkg.devDependencies);
  if (devDependencies[packageName]) {
    return devDependencies[packageName];
  }

  const dependencies = readDependencySection(pkg.dependencies);
  if (dependencies[packageName]) {
    return dependencies[packageName];
  }

  return UNKNOWN_VERSION;
}

function readDependencySection(section: unknown): Record<string, string> {
  if (!section || typeof section !== "object") {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [name, version] of Object.entries(section as Record<string, unknown>)) {
    if (typeof version === "string") {
      result[name] = version;
    }
  }
  return result;
}

function parseNpmToolVersion(
  packageManager: string | undefined,
  enginesNpm: string | undefined,
): string {
  if (packageManager) {
    const atMatch = packageManager.match(/@([0-9].+)$/);
    if (atMatch?.[1]) {
      return atMatch[1];
    }
  }

  return enginesNpm ?? UNKNOWN_VERSION;
}

function firstNonUnknown(...values: readonly (string | undefined)[]): string | undefined {
  for (const value of values) {
    if (value && value.trim() !== "") {
      return value.trim();
    }
  }
  return undefined;
}
