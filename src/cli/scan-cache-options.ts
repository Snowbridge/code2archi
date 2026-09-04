import type { Options } from "yargs";
import { CliError } from "./cli-error.js";
import type { ScanIoCacheOptions } from "../platform/scan-io/scan-io-options.js";

export interface ScanCommandCacheArgv {
  readonly cache: boolean;
  readonly cacheFileMb: number;
  readonly cacheDirEntries: number;
  readonly cacheParse: boolean;
  readonly cacheParseEntries: number;
}

function coerceNonNegativeInteger(value: unknown, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new CliError(`Invalid ${flag}: expected integer >= 0`);
  }
  return parsed;
}

export function cacheArgvToScanIoOptions(argv: ScanCommandCacheArgv): ScanIoCacheOptions {
  const kotlinNodejsEntries = Math.floor(argv.cacheParseEntries / 2);
  return {
    enabled: argv.cache,
    fileCacheMegabytes: argv.cacheFileMb,
    dirCacheEntries: argv.cacheDirEntries,
    parseCacheEnabled: argv.cacheParse,
    parseCacheJavaEntries: argv.cacheParseEntries,
    parseCacheKotlinEntries: kotlinNodejsEntries,
    parseCacheNodejsEntries: kotlinNodejsEntries,
  };
}

export const scanCommandCacheOptions: Record<string, Options> = {
  cache: {
    type: "boolean",
    default: true,
    describe: "Enable inter-processor scan I/O cache (file, directory walk, parse AST)",
  },
  "cache-file-mb": {
    type: "number",
    default: 256,
    coerce: (value: unknown) => coerceNonNegativeInteger(value, "--cache-file-mb"),
    describe: "UTF-8 file cache limit per thread in MiB; 0 disables file cache",
  },
  "cache-dir-entries": {
    type: "number",
    default: 10_000,
    coerce: (value: unknown) => coerceNonNegativeInteger(value, "--cache-dir-entries"),
    describe: "Directory walk cache entry limit per thread; 0 disables dir cache",
  },
  "cache-parse": {
    type: "boolean",
    default: true,
    describe: "Enable parse AST cache for Java, Kotlin, and Node.js sources",
  },
  "cache-parse-entries": {
    type: "number",
    default: 8_000,
    coerce: (value: unknown) => coerceNonNegativeInteger(value, "--cache-parse-entries"),
    describe:
      "Java parse cache entry limit; Kotlin and Node.js use floor(n/2); 0 disables parse cache",
  },
};
