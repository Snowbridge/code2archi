import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const UNKNOWN_VERSION = "unknown";

export interface ModuleBuildVersions {
  readonly buildToolVersion: string;
  readonly javaVersion: string;
  readonly kotlinJvmTarget: string;
  readonly kotlinCompilerVersion: string;
  readonly nodeVersion: string;
}

export function unknownBuildVersions(): ModuleBuildVersions {
  return {
    buildToolVersion: UNKNOWN_VERSION,
    javaVersion: UNKNOWN_VERSION,
    kotlinJvmTarget: UNKNOWN_VERSION,
    kotlinCompilerVersion: UNKNOWN_VERSION,
    nodeVersion: UNKNOWN_VERSION,
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

export function parseGradleBuildVersions(content: string): ModuleBuildVersions {
  const javaVersion = parseGradleJavaVersion(content);
  const kotlinJvmTarget = parseGradleKotlinJvmTarget(content);
  const kotlinCompilerVersion = parseGradleKotlinCompilerVersion(content);

  return {
    buildToolVersion: UNKNOWN_VERSION,
    javaVersion,
    kotlinJvmTarget,
    kotlinCompilerVersion,
    nodeVersion: UNKNOWN_VERSION,
  };
}

export function mergeGradleModuleVersions(
  repoRoot: string,
  buildFileContent: string,
): ModuleBuildVersions {
  const fromBuild = parseGradleBuildVersions(buildFileContent);
  const wrapperVersion = readGradleWrapperVersion(repoRoot);
  return {
    ...fromBuild,
    buildToolVersion: wrapperVersion !== UNKNOWN_VERSION ? wrapperVersion : fromBuild.buildToolVersion,
  };
}

function parseGradleJavaVersion(content: string): string {
  const toolchainMatch = content.match(/languageVersion\s*=\s*JavaLanguageVersion\.of\((\d+)\)/);
  if (toolchainMatch?.[1]) {
    return toolchainMatch[1];
  }

  const sourceCompatMatch = content.match(
    /sourceCompatibility\s*=\s*(?:JavaVersion\.)?VERSION_(\d+)(?:_(?:\d+))?|sourceCompatibility\s*=\s*['"](\d+)['"]/,
  );
  const version = sourceCompatMatch?.[1] ?? sourceCompatMatch?.[2];
  if (version) {
    return version;
  }

  const targetCompatMatch = content.match(
    /targetCompatibility\s*=\s*(?:JavaVersion\.)?VERSION_(\d+)(?:_(?:\d+))?|targetCompatibility\s*=\s*['"](\d+)['"]/,
  );
  return targetCompatMatch?.[1] ?? targetCompatMatch?.[2] ?? UNKNOWN_VERSION;
}

function parseGradleKotlinJvmTarget(content: string): string {
  const match = content.match(/jvmTarget\s*=\s*['"]?(\d+(?:\.\d+)?)['"]?/);
  return match?.[1] ?? UNKNOWN_VERSION;
}

function parseGradleKotlinCompilerVersion(content: string): string {
  const pluginMatch = content.match(
    /(?:id|kotlin)\s*\(\s*['"]org\.jetbrains\.kotlin\.(?:jvm|multiplatform|android)['"]\s*\)\s*version\s*['"]([^'"]+)['"]/,
  );
  if (pluginMatch?.[1]) {
    return pluginMatch[1];
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
  };
}

export function mergeNpmChildVersions(
  childPkg: Record<string, unknown>,
  rootPkg: Record<string, unknown>,
): ModuleBuildVersions {
  const child = parseNpmBuildVersions(childPkg);
  const root = parseNpmBuildVersions(rootPkg);

  return {
    buildToolVersion:
      child.buildToolVersion !== UNKNOWN_VERSION ? child.buildToolVersion : root.buildToolVersion,
    javaVersion: UNKNOWN_VERSION,
    kotlinJvmTarget: UNKNOWN_VERSION,
    kotlinCompilerVersion: UNKNOWN_VERSION,
    nodeVersion: child.nodeVersion !== UNKNOWN_VERSION ? child.nodeVersion : root.nodeVersion,
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
