import { LruByteCache } from "./lru-byte-cache.js";
import { LruEntryCache } from "./lru-entry-cache.js";
import {
  DEFAULT_SCAN_IO_CACHE_OPTIONS,
  type ScanIoCacheOptions,
} from "./scan-io-options.js";

interface ScanIoCacheState {
  options: ScanIoCacheOptions;
  fileCache: LruByteCache<string>;
  dirCache: LruEntryCache<readonly string[]>;
  javaParseCache: LruEntryCache<unknown>;
  kotlinParseCache: LruEntryCache<unknown>;
  nodejsParseCache: LruEntryCache<unknown>;
}

let state: ScanIoCacheState | null = null;

function createState(options: ScanIoCacheOptions): ScanIoCacheState {
  return {
    options,
    fileCache: new LruByteCache<string>(options.fileCacheMegabytes * 1024 * 1024),
    dirCache: new LruEntryCache<readonly string[]>(options.dirCacheEntries),
    javaParseCache: new LruEntryCache<unknown>(options.parseCacheJavaEntries),
    kotlinParseCache: new LruEntryCache<unknown>(options.parseCacheKotlinEntries),
    nodejsParseCache: new LruEntryCache<unknown>(options.parseCacheNodejsEntries),
  };
}

export function initScanIoCache(options: ScanIoCacheOptions = DEFAULT_SCAN_IO_CACHE_OPTIONS): void {
  state = createState(options);
}

export function resetScanIoCache(): void {
  if (!state) {
    return;
  }
  state.fileCache.clear();
  state.dirCache.clear();
  state.javaParseCache.clear();
  state.kotlinParseCache.clear();
  state.nodejsParseCache.clear();
}

export function getScanIoCacheOptions(): ScanIoCacheOptions {
  return state?.options ?? DEFAULT_SCAN_IO_CACHE_OPTIONS;
}

export function getScanIoCacheState(): ScanIoCacheState {
  if (!state) {
    state = createState(DEFAULT_SCAN_IO_CACHE_OPTIONS);
  }
  return state;
}

export type { ScanIoCacheState };
