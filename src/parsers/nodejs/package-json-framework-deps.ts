import { readFileSync } from "node:fs";
import path from "node:path";

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

function readDependencyNames(packageJsonPath: string): Set<string> {
  try {
    const raw = readFileSync(packageJsonPath, "utf8");
    const json = JSON.parse(raw) as Record<string, unknown>;
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
  } catch {
    return new Set();
  }
}

export function hasFrameworkPackage(
  packageRoot: string,
  framework: NodejsFrameworkPackage,
): boolean {
  const packageJsonPath = path.join(packageRoot, "package.json");
  const dependencyNames = readDependencyNames(packageJsonPath);
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
