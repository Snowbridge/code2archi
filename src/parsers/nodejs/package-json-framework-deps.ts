import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseNpmBuildVersions, UNKNOWN_VERSION } from "../build-tool-versions.js";

export type NodejsFrameworkPackage =
  | "express"
  | "fastify"
  | "hono"
  | "koa"
  | "@koa/router"
  | "@nestjs/common"
  | "next"
  | "axios"
  | "got"
  | "undici"
  | "superagent"
  | "@nestjs/axios";

const FRAMEWORK_PACKAGE_MAP: Record<NodejsFrameworkPackage, readonly string[]> = {
  express: ["express"],
  fastify: ["fastify"],
  hono: ["hono"],
  koa: ["koa"],
  "@koa/router": ["@koa/router", "koa-router"],
  "@nestjs/common": ["@nestjs/common"],
  next: ["next"],
  axios: ["axios"],
  got: ["got"],
  undici: ["undici"],
  superagent: ["superagent"],
  "@nestjs/axios": ["@nestjs/axios"],
};

const NODEJS_REST_FRAMEWORK_PACKAGES: readonly NodejsFrameworkPackage[] = [
  "express",
  "fastify",
  "hono",
  "koa",
  "@koa/router",
  "@nestjs/common",
  "next",
  "axios",
  "got",
  "undici",
  "superagent",
  "@nestjs/axios",
];

function readPackageJson(packageJsonPath: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function collectNpmPackageRoots(packageRoot: string, repositoryRoot: string): readonly string[] {
  const repoRoot = path.resolve(repositoryRoot);
  const roots: string[] = [];
  let current = path.resolve(packageRoot);

  while (current.length >= repoRoot.length && current.startsWith(repoRoot)) {
    if (existsSync(path.join(current, "package.json"))) {
      roots.push(current);
    }
    if (current === repoRoot) {
      break;
    }
    current = path.dirname(current);
  }

  return roots;
}

function readDependencyNames(packageJsonPath: string): Set<string> {
  const json = readPackageJson(packageJsonPath);
  if (!json) {
    return new Set();
  }

  const names = new Set<string>();
  for (const section of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = json[section];
    if (typeof deps === "object" && deps !== null) {
      for (const name of Object.keys(deps)) {
        names.add(name);
      }
    }
  }

  return names;
}

function readDependencyNamesFromPackageRoots(packageRoots: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const root of packageRoots) {
    for (const name of readDependencyNames(path.join(root, "package.json"))) {
      names.add(name);
    }
  }
  return names;
}

export function hasNpmToolchainInPackageTree(
  packageRoot: string,
  repositoryRoot: string,
): boolean {
  for (const root of collectNpmPackageRoots(packageRoot, repositoryRoot)) {
    const pkg = readPackageJson(path.join(root, "package.json"));
    if (!pkg) {
      continue;
    }

    const versions = parseNpmBuildVersions(pkg);
    if (
      versions.nodeVersion !== UNKNOWN_VERSION ||
      versions.typescriptVersion !== UNKNOWN_VERSION ||
      versions.tsxVersion !== UNKNOWN_VERSION
    ) {
      return true;
    }
  }

  return false;
}

export function hasAnyNodejsRestFrameworkInPackageTree(
  packageRoot: string,
  repositoryRoot: string,
): boolean {
  const packageRoots = collectNpmPackageRoots(packageRoot, repositoryRoot);
  const dependencyNames = readDependencyNamesFromPackageRoots(packageRoots);

  return NODEJS_REST_FRAMEWORK_PACKAGES.some((framework) =>
    FRAMEWORK_PACKAGE_MAP[framework].some((candidate) => dependencyNames.has(candidate)),
  );
}

export function hasFrameworkPackage(
  packageRoot: string,
  framework: NodejsFrameworkPackage,
  repositoryRoot?: string,
): boolean {
  const packageRoots =
    repositoryRoot === undefined
      ? [packageRoot]
      : collectNpmPackageRoots(packageRoot, repositoryRoot);
  const dependencyNames = readDependencyNamesFromPackageRoots(packageRoots);
  const candidates = FRAMEWORK_PACKAGE_MAP[framework];

  return candidates.some((candidate) => dependencyNames.has(candidate));
}

export function listInstalledFrameworkPackages(packageRoot: string): NodejsFrameworkPackage[] {
  const installed: NodejsFrameworkPackage[] = [];

  for (const framework of Object.keys(FRAMEWORK_PACKAGE_MAP) as NodejsFrameworkPackage[]) {
    if (hasFrameworkPackage(packageRoot, framework)) {
      installed.push(framework);
    }
  }

  return installed;
}
