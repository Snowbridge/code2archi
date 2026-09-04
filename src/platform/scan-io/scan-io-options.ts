export interface ScanIoCacheOptions {
  readonly enabled: boolean;
  readonly fileCacheMegabytes: number;
  readonly dirCacheEntries: number;
  readonly parseCacheEnabled: boolean;
  readonly parseCacheJavaEntries: number;
  readonly parseCacheKotlinEntries: number;
  readonly parseCacheNodejsEntries: number;
}

export const DEFAULT_SCAN_IO_CACHE_OPTIONS: ScanIoCacheOptions = {
  enabled: true,
  fileCacheMegabytes: 256,
  dirCacheEntries: 10_000,
  parseCacheEnabled: true,
  parseCacheJavaEntries: 8_000,
  parseCacheKotlinEntries: 4_000,
  parseCacheNodejsEntries: 4_000,
};

export const DISABLED_SCAN_IO_CACHE_OPTIONS: ScanIoCacheOptions = {
  enabled: false,
  fileCacheMegabytes: 0,
  dirCacheEntries: 0,
  parseCacheEnabled: false,
  parseCacheJavaEntries: 0,
  parseCacheKotlinEntries: 0,
  parseCacheNodejsEntries: 0,
};
