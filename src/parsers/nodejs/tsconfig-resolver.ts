import { readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_EXCLUDE_SEGMENTS = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
  "__tests__",
]);

const TSCONFIG_CANDIDATES = ["tsconfig.app.json", "tsconfig.json"];

export interface TsconfigInfo {
  readonly configDir: string;
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly rootDir?: string;
}

function readJsonFile(absolutePath: string): Record<string, unknown> | undefined {
  try {
    const raw = readFileSync(absolutePath, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

export function resolveTsconfig(packageRoot: string): TsconfigInfo | undefined {
  for (const candidate of TSCONFIG_CANDIDATES) {
    const configPath = path.join(packageRoot, candidate);
    const json = readJsonFile(configPath);
    if (!json) {
      continue;
    }

    const compilerOptions =
      typeof json.compilerOptions === "object" && json.compilerOptions !== null
        ? (json.compilerOptions as Record<string, unknown>)
        : undefined;

    const rootDir =
      typeof compilerOptions?.rootDir === "string" ? compilerOptions.rootDir : undefined;

    return {
      configDir: packageRoot,
      include: asStringArray(json.include),
      exclude: asStringArray(json.exclude),
      ...(rootDir ? { rootDir } : {}),
    };
  }

  return undefined;
}

function normalizePatternSegment(pattern: string): string {
  return pattern.replace(/^\.\//, "").replace(/\/\*+$/, "").replace(/\/\*\*.*$/, "");
}

export function resolveIncludeDirectories(packageRoot: string, tsconfig?: TsconfigInfo): string[] {
  const directories = new Set<string>();

  if (tsconfig && tsconfig.include.length > 0) {
    for (const pattern of tsconfig.include) {
      const normalized = normalizePatternSegment(pattern);
      if (!normalized || normalized.includes("*")) {
        directories.add(packageRoot);
        continue;
      }

      directories.add(path.join(packageRoot, normalized));
    }
  } else {
    const srcDir = path.join(packageRoot, "src");
    directories.add(srcDir);
    directories.add(packageRoot);
  }

  if (tsconfig?.rootDir) {
    const rootDirPath = path.isAbsolute(tsconfig.rootDir)
      ? tsconfig.rootDir
      : path.join(packageRoot, tsconfig.rootDir);
    return [...directories]
      .map((directory) => path.join(rootDirPath, path.relative(packageRoot, directory)))
      .filter((directory) => directory.startsWith(packageRoot));
  }

  return [...directories];
}

export function shouldExcludePath(absolutePath: string, tsconfig?: TsconfigInfo): boolean {
  const normalized = absolutePath.replace(/\\/g, "/").toLowerCase();
  const segments = normalized.split("/");

  for (const segment of segments) {
    if (DEFAULT_EXCLUDE_SEGMENTS.has(segment)) {
      return true;
    }
  }

  if (/\.(test|spec)\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(normalized)) {
    return true;
  }

  if (tsconfig) {
    for (const pattern of tsconfig.exclude) {
      const normalizedPattern = pattern.replace(/\\/g, "/").toLowerCase();
      if (normalized.includes(normalizedPattern.replace(/^\.\//, ""))) {
        return true;
      }
    }
  }

  return false;
}

export function resolveNextJsAppDirectory(packageRoot: string): string {
  return path.join(packageRoot, "app");
}
