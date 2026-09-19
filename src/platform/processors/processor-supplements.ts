import { existsSync } from "node:fs";
import path from "node:path";
import { readFileSync } from "node:fs";
import { CliError } from "../../cli/cli-error.js";
import { ExitCode } from "../../cli/exit-codes.js";
import { getLogger } from "../logging/index.js";
import { matchesPattern, validateFilterPattern } from "./processor-coordinate.js";
import type { ProcessorId } from "./processor.js";
import type { ProcessorFilters } from "./processor-registry.js";
import { processorRegistry } from "./processor-registry.js";
import type { BuiltInProcessorGroupId } from "../../cli/processor-groups.js";

export interface ProcessorSupplementRef {
  readonly path: string;
  readonly basename: string;
}

export interface ProcessorSupplementDeclaration {
  readonly target: string;
  readonly paths: readonly ProcessorSupplementRef[];
}

export interface ProcessorSupplementCatalog {
  readonly declarations: readonly ProcessorSupplementDeclaration[];
}

export type SerializableProcessorSupplementCatalog = ProcessorSupplementCatalog;

const SUPPLEMENT_TARGET_PATH_SEPARATOR = "@";

export function parseSupplementToken(token: string): { target: string; filePath: string } {
  const separatorIndex = token.indexOf(SUPPLEMENT_TARGET_PATH_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    throw new CliError(
      `Invalid --supplement value "${token}": expected <coordinate>@<path>`,
      ExitCode.ARGV,
    );
  }

  const target = token.slice(0, separatorIndex).trim();
  const filePath = token.slice(separatorIndex + 1).trim();
  if (target.length === 0 || filePath.length === 0) {
    throw new CliError(
      `Invalid --supplement value "${token}": expected <coordinate>@<path>`,
      ExitCode.ARGV,
    );
  }

  validateFilterPattern(target);
  return { target, filePath };
}

export function supplementToken(target: string, filePath: string): string {
  return `${target}${SUPPLEMENT_TARGET_PATH_SEPARATOR}${filePath}`;
}

export function normalizeSupplementConfigValue(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  const tokens: string[] = [];

  const appendValue = (entry: unknown): void => {
    if (typeof entry === "string") {
      tokens.push(entry);
      return;
    }

    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return;
    }

    const record = entry as Record<string, unknown>;
    const target = record.target;
    const paths = record.paths;
    if (typeof target !== "string" || !Array.isArray(paths)) {
      return;
    }

    for (const filePath of paths) {
      if (typeof filePath === "string" && filePath.length > 0) {
        tokens.push(supplementToken(target, filePath));
      }
    }
  };

  if (Array.isArray(value)) {
    for (const entry of value) {
      appendValue(entry);
    }
    return tokens;
  }

  appendValue(value);
  return tokens;
}

export function normalizeSupplementArgv(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return [String(value)];
}

export function resolveProcessorSupplementCatalog(
  tokens: readonly string[],
  cwd: string,
): ProcessorSupplementCatalog {
  const declarationBuckets = new Map<string, ProcessorSupplementRef[]>();

  for (const token of tokens) {
    const { target, filePath } = parseSupplementToken(token);
    const absolutePath = path.resolve(cwd, filePath);
    if (!existsSync(absolutePath)) {
      throw new CliError(
        `Supplement file not found: ${absolutePath} (from --supplement ${token})`,
        ExitCode.ARGV,
      );
    }

    const ref: ProcessorSupplementRef = {
      path: absolutePath,
      basename: path.basename(absolutePath),
    };

    const bucket = declarationBuckets.get(target) ?? [];
    bucket.push(ref);
    declarationBuckets.set(target, bucket);
  }

  const declarations = [...declarationBuckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([target, paths]) => ({
      target,
      paths: [...paths].sort((left, right) => left.path.localeCompare(right.path)),
    }));

  return { declarations };
}

export function filterSupplementsForProcessor(
  catalog: ProcessorSupplementCatalog,
  processorId: ProcessorId,
): readonly ProcessorSupplementRef[] {
  const refs: ProcessorSupplementRef[] = [];

  for (const declaration of catalog.declarations) {
    if (!matchesPattern(processorId, declaration.target)) {
      continue;
    }
    refs.push(...declaration.paths);
  }

  return refs;
}

export function warnUnusedSupplementTargets(
  catalog: ProcessorSupplementCatalog,
  runningProcessors: readonly ProcessorId[],
): void {
  if (catalog.declarations.length === 0) {
    return;
  }

  const logger = getLogger("platform.processor-supplements");

  for (const declaration of catalog.declarations) {
    const matched = runningProcessors.some((processorId) =>
      matchesPattern(processorId, declaration.target),
    );
    if (!matched) {
      logger.warn("supplement target matched no running processor", {
        target: declaration.target,
        pathCount: declaration.paths.length,
      });
    }
  }
}

export function listRunningProcessorIds(
  builtInGroupIds: readonly BuiltInProcessorGroupId[],
  filters: ProcessorFilters,
): ProcessorId[] {
  const ids: ProcessorId[] = [];
  for (const groupId of builtInGroupIds) {
    const processors = processorRegistry.listForBuiltInStep(groupId, filters);
    for (const processor of processors) {
      ids.push(processor.id);
    }
  }
  return ids;
}

export function withProcessorSupplements<T extends object>(
  input: T,
  supplements: readonly ProcessorSupplementRef[],
): T & { supplements?: readonly ProcessorSupplementRef[] } {
  if (supplements.length === 0) {
    return input;
  }
  // Wrap in a Proxy rather than spreading/cloning so that the input keeps
  // delegating to its original prototype (e.g. CodeInventorySnapshot methods
  // such as listEntities) and any get-trap-provided properties (e.g. a
  // `progress` handle exposed via an existing Proxy). Only `supplements` is
  // overridden.
  return new Proxy(input, {
    get(target, prop, receiver) {
      if (prop === "supplements") {
        return supplements;
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
    has(target, prop) {
      return prop === "supplements" || Reflect.has(target, prop);
    },
    ownKeys(target) {
      return Array.from(new Set([...Reflect.ownKeys(target), "supplements"]));
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === "supplements") {
        return { value: supplements, writable: true, enumerable: true, configurable: true };
      }
      return Object.getOwnPropertyDescriptor(target, prop);
    },
  }) as T & { supplements?: readonly ProcessorSupplementRef[] };
}

export function readSupplementUtf8Files(refs: readonly ProcessorSupplementRef[]): string[] {
  return refs.map((ref) => readFileSync(ref.path, "utf8"));
}

