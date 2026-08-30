import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

import { mergeMavenModuleVersions } from "./build-tool-versions.js";

export interface MavenCoordinates {
  readonly groupId: string;
  readonly artifactId: string;
  readonly version: string;
}

export interface MavenDependency extends MavenCoordinates {
  readonly scope?: string;
  readonly type?: string;
}

export interface MavenModuleParseResult {
  readonly coordinates: MavenCoordinates;
  readonly buildScript: string;
  readonly repoPath: string;
  readonly parentCoordinates?: MavenCoordinates;
  readonly childModulePaths: readonly string[];
  readonly dependencies: readonly MavenDependency[];
  readonly isMultimodule: boolean;
  readonly buildToolVersion: string;
  readonly javaVersion: string;
  readonly kotlinJvmTarget: string;
  readonly kotlinCompilerVersion: string;
  readonly nodeVersion: string;
}

interface PomDocument {
  readonly groupId?: string;
  readonly artifactId?: string;
  readonly version?: string;
  readonly packaging?: string;
  readonly parent?: {
    readonly groupId?: string;
    readonly artifactId?: string;
    readonly version?: string;
    readonly relativePath?: string;
  };
  readonly properties?: Record<string, string>;
  readonly modules?: readonly string[];
  readonly dependencies?: readonly MavenDependency[];
  readonly dependencyManagement?: readonly MavenDependency[];
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
  isArray: (tagName) =>
    tagName === "module" ||
    tagName === "dependency" ||
    tagName === "profile" ||
    tagName === "property",
});

export function parseMavenRepository(
  repoRoot: string,
  rootPomRelativePath = "pom.xml",
): MavenModuleParseResult[] {
  const results: MavenModuleParseResult[] = [];
  const visited = new Set<string>();

  function visit(pomRelativePath: string, parentCoordinates?: MavenCoordinates): void {
    const normalized = pomRelativePath.replace(/\\/g, "/");
    if (visited.has(normalized)) {
      return;
    }
    visited.add(normalized);

    const absolutePomPath = path.join(repoRoot, normalized);
    if (!existsSync(absolutePomPath)) {
      return;
    }

    const pomContent = readFileSync(absolutePomPath, "utf8");
    const effective = buildEffectivePom(repoRoot, normalized);
    const buildVersions = mergeMavenModuleVersions(repoRoot, effective.properties, pomContent);
    const childModulePaths = effective.modules.map((moduleName) => {
      const moduleDir = path.posix.join(posixDirname(normalized), moduleName);
      return path.posix.join(moduleDir, "pom.xml");
    });

    const moduleCoordinates = {
      groupId: effective.groupId,
      artifactId: effective.artifactId,
      version: effective.version,
    };

    results.push({
      coordinates: moduleCoordinates,
      buildScript: normalized,
      repoPath: posixDirname(normalized),
      parentCoordinates,
      childModulePaths,
      dependencies: effective.dependencies,
      isMultimodule: effective.modules.length > 0,
      ...buildVersions,
    });

    for (const childPath of childModulePaths) {
      visit(childPath, moduleCoordinates);
    }
  }

  visit(rootPomRelativePath);
  return results;
}

function buildEffectivePom(repoRoot: string, pomRelativePath: string): {
  readonly groupId: string;
  readonly artifactId: string;
  readonly version: string;
  readonly modules: readonly string[];
  readonly dependencies: readonly MavenDependency[];
  readonly properties: Record<string, string>;
} {
  const chain = loadParentChain(repoRoot, pomRelativePath);
  const mergedProperties: Record<string, string> = {};
  const managedDependencies = new Map<string, MavenDependency>();

  for (const pom of chain) {
    Object.assign(mergedProperties, pom.properties);
    for (const dependency of pom.dependencyManagement ?? []) {
      managedDependencies.set(dependencyKey(dependency), dependency);
    }
  }

  for (const pom of chain) {
    for (const dependency of pom.dependencyManagement ?? []) {
      if (dependency.scope === "import" && dependency.type === "pom") {
        mergeBom(repoRoot, pomRelativePath, dependency, mergedProperties, managedDependencies);
      }
    }
  }

  const leaf = chain[chain.length - 1]!;
  const coordinates = resolveCoordinates(chain, mergedProperties);
  const dependencies = (leaf.dependencies ?? []).map((dependency) =>
    resolveDependency(dependency, mergedProperties, managedDependencies),
  );

  return {
    groupId: coordinates.groupId,
    artifactId: coordinates.artifactId,
    version: coordinates.version,
    modules: leaf.modules ?? [],
    dependencies,
    properties: mergedProperties,
  };
}

function loadParentChain(repoRoot: string, pomRelativePath: string): PomDocument[] {
  const chain: PomDocument[] = [];
  const visited = new Set<string>();
  let currentRelativePath = pomRelativePath.replace(/\\/g, "/");

  while (true) {
    if (visited.has(currentRelativePath)) {
      break;
    }
    visited.add(currentRelativePath);

    const absolutePath = path.join(repoRoot, currentRelativePath);
    if (!existsSync(absolutePath)) {
      break;
    }

    const parsed = parsePomFile(readFileSync(absolutePath, "utf8"));
    chain.unshift(parsed);

    if (!parsed.parent?.artifactId) {
      break;
    }

    const parentRelativePath = resolveParentRelativePath(
      currentRelativePath,
      parsed.parent.relativePath,
    );
    const parentAbsolutePath = path.join(repoRoot, parentRelativePath);
    if (!existsSync(parentAbsolutePath)) {
      break;
    }

    currentRelativePath = parentRelativePath;
  }

  return chain;
}

function parsePomFile(content: string): PomDocument {
  const root = xmlParser.parse(content);
  const project = root.project ?? root;

  return {
    groupId: textValue(project.groupId),
    artifactId: textValue(project.artifactId) ?? "",
    version: textValue(project.version),
    packaging: textValue(project.packaging),
    parent: project.parent
      ? {
          groupId: textValue(project.parent.groupId),
          artifactId: textValue(project.parent.artifactId) ?? undefined,
          version: textValue(project.parent.version),
          relativePath: textValue(project.parent.relativePath),
        }
      : undefined,
    properties: parseProperties(project.properties),
    modules: parseModules(project.modules),
    dependencies: parseDependencies(project.dependencies),
    dependencyManagement: parseDependencies(
      (project.dependencyManagement as { dependencies?: unknown } | undefined)?.dependencies,
    ),
  };
}

function parseProperties(propertiesNode: unknown): Record<string, string> {
  if (!propertiesNode || typeof propertiesNode !== "object") {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(propertiesNode as Record<string, unknown>)) {
    const text = textValue(value);
    if (text !== undefined) {
      result[key] = text;
    }
  }

  return result;
}

function parseModules(modulesNode: unknown): string[] {
  if (!modulesNode || typeof modulesNode !== "object") {
    return [];
  }

  const moduleEntries = (modulesNode as { module?: unknown }).module;
  if (!moduleEntries) {
    return [];
  }

  const values = Array.isArray(moduleEntries) ? moduleEntries : [moduleEntries];
  return values
    .map((value) => textValue(value))
    .filter((value): value is string => value !== undefined);
}

function parseDependencies(dependenciesNode: unknown): MavenDependency[] {
  if (!dependenciesNode || typeof dependenciesNode !== "object") {
    return [];
  }

  const dependencyEntries = (dependenciesNode as { dependency?: unknown }).dependency;
  if (!dependencyEntries) {
    return [];
  }

  const values = Array.isArray(dependencyEntries) ? dependencyEntries : [dependencyEntries];
  return values
    .map((entry) => parseDependencyEntry(entry))
    .filter((dependency): dependency is MavenDependency => dependency !== undefined);
}

function parseDependencyEntry(entry: unknown): MavenDependency | undefined {
  if (!entry || typeof entry !== "object") {
    return undefined;
  }

  const node = entry as Record<string, unknown>;
  const groupId = textValue(node.groupId);
  const artifactId = textValue(node.artifactId);
  if (!groupId || !artifactId) {
    return undefined;
  }

  return {
    groupId,
    artifactId,
    version: textValue(node.version) ?? "",
    scope: textValue(node.scope),
    type: textValue(node.type),
  };
}

function resolveCoordinates(
  chain: readonly PomDocument[],
  properties: Record<string, string>,
): MavenCoordinates {
  let groupId = "";
  let artifactId = "";
  let version = "";

  for (const pom of chain) {
    if (pom.groupId) {
      groupId = interpolate(pom.groupId, properties);
    }
    if (pom.artifactId) {
      artifactId = interpolate(pom.artifactId, properties);
    }
    if (pom.version) {
      version = interpolate(pom.version, properties);
    }
    if (pom.parent?.groupId && !groupId) {
      groupId = interpolate(pom.parent.groupId, properties);
    }
    if (pom.parent?.version && !version) {
      version = interpolate(pom.parent.version, properties);
    }
  }

  return { groupId, artifactId, version };
}

function resolveDependency(
  dependency: MavenDependency,
  properties: Record<string, string>,
  managedDependencies: Map<string, MavenDependency>,
): MavenDependency {
  const groupId = interpolate(dependency.groupId, properties);
  const artifactId = interpolate(dependency.artifactId, properties);
  const managed = managedDependencies.get(`${groupId}:${artifactId}`);

  return {
    groupId,
    artifactId,
    version: interpolate(dependency.version || managed?.version || "", properties),
    scope: dependency.scope ?? managed?.scope,
    type: dependency.type ?? managed?.type,
  };
}

function mergeBom(
  repoRoot: string,
  currentPomRelativePath: string,
  bomDependency: MavenDependency,
  properties: Record<string, string>,
  managedDependencies: Map<string, MavenDependency>,
): void {
  const bomPath = resolveBomPath(repoRoot, currentPomRelativePath, bomDependency, properties);
  if (!bomPath || !existsSync(bomPath)) {
    return;
  }

  const bomPom = parsePomFile(readFileSync(bomPath, "utf8"));
  const bomChain = loadParentChain(repoRoot, toRepoRelativePath(repoRoot, bomPath));
  const bomProperties = { ...properties };
  for (const pom of bomChain) {
    Object.assign(bomProperties, pom.properties);
  }

  for (const dependency of bomPom.dependencyManagement ?? []) {
    const resolved = resolveDependency(dependency, bomProperties, managedDependencies);
    managedDependencies.set(dependencyKey(resolved), resolved);
  }
}

function resolveBomPath(
  repoRoot: string,
  currentPomRelativePath: string,
  bomDependency: MavenDependency,
  properties: Record<string, string>,
): string | undefined {
  const groupId = interpolate(bomDependency.groupId, properties);
  const artifactId = interpolate(bomDependency.artifactId, properties);
  const version = interpolate(bomDependency.version, properties);
  if (!groupId || !artifactId || !version) {
    return undefined;
  }

  const groupPath = groupId.replace(/\./g, path.sep);
  const localRepoCandidate = path.join(
    repoRoot,
    ".m2-repos-fallback-does-not-exist",
    groupPath,
    artifactId,
    version,
    `${artifactId}-${version}.pom`,
  );

  if (existsSync(localRepoCandidate)) {
    return localRepoCandidate;
  }

  const pomDir = path.dirname(path.join(repoRoot, currentPomRelativePath));
  const siblingCandidate = path.join(
    pomDir,
    groupPath,
    artifactId,
    version,
    `${artifactId}-${version}.pom`,
  );
  if (existsSync(siblingCandidate)) {
    return siblingCandidate;
  }

  return undefined;
}

function resolveParentRelativePath(
  currentPomRelativePath: string,
  relativePath?: string,
): string {
  const currentDir = posixDirname(currentPomRelativePath);
  const parentPath = relativePath?.trim();
  if (!parentPath || parentPath === "") {
    return path.posix.join(currentDir, "../pom.xml");
  }

  if (path.posix.isAbsolute(parentPath)) {
    return parentPath.replace(/^\//, "");
  }

  return path.posix.normalize(path.posix.join(currentDir, parentPath));
}

function interpolate(value: string, properties: Record<string, string>): string {
  let result = value;
  for (let iteration = 0; iteration < 10; iteration += 1) {
    const next = result.replace(/\$\{([^}]+)\}/g, (_match, key: string) => {
      const propertyKey = key.trim();
      if (propertyKey === "project.version" && properties.version) {
        return properties.version;
      }
      if (propertyKey === "project.groupId" && properties.groupId) {
        return properties.groupId;
      }
      if (propertyKey === "project.artifactId" && properties.artifactId) {
        return properties.artifactId;
      }
      return properties[propertyKey] ?? _match;
    });

    if (next === result) {
      break;
    }
    result = next;
  }

  return result;
}

function dependencyKey(dependency: Pick<MavenDependency, "groupId" | "artifactId">): string {
  return `${dependency.groupId}:${dependency.artifactId}`;
}

function textValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object" && value !== null && "#text" in value) {
    const text = (value as { "#text"?: unknown })["#text"];
    if (text === undefined || text === null) {
      return undefined;
    }
    return String(text);
  }

  return undefined;
}

function posixDirname(filePath: string): string {
  const index = filePath.lastIndexOf("/");
  if (index <= 0) {
    return ".";
  }

  return filePath.slice(0, index);
}

function toRepoRelativePath(repoRoot: string, absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}
