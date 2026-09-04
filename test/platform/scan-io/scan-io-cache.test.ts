import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  cacheArgvToScanIoOptions,
  type ScanCommandCacheArgv,
} from "../../../src/cli/scan-cache-options.js";
import { DEFAULT_SCAN_IO_CACHE_OPTIONS } from "../../../src/platform/scan-io/scan-io-options.js";
import {
  initScanIoCache,
  listScanSourceFiles,
  readScanUtf8File,
  resetScanIoCache,
} from "../../../src/platform/scan-io/index.js";

const tempDirs: string[] = [];

afterEach(() => {
  resetScanIoCache();
  for (const dir of tempDirs.splice(0)) {
    // best-effort cleanup; temp dirs are unique per test
    void dir;
  }
});

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe("scan-io cache", () => {
  it("caches file reads and directory walks within a phase", () => {
    const root = createTempDir("c2a-scan-io-");
    const nested = path.join(root, "src");
    mkdirSync(nested, { recursive: true });
    const filePath = path.join(nested, "Example.java");
    writeFileSync(filePath, "class Example {}\n", "utf8");

    initScanIoCache({
      ...DEFAULT_SCAN_IO_CACHE_OPTIONS,
      fileCacheMegabytes: 1,
      dirCacheEntries: 10,
    });

    const firstWalk = listScanSourceFiles(nested, ".java");
    const secondWalk = listScanSourceFiles(nested, ".java");
    assert.deepEqual(secondWalk, firstWalk);

    const firstRead = readScanUtf8File(filePath);
    const secondRead = readScanUtf8File(filePath);
    assert.equal(secondRead, firstRead);

    resetScanIoCache();
    const afterReset = readScanUtf8File(filePath);
    assert.equal(afterReset, firstRead);
  });

  it("passes through when cache is disabled", () => {
    const root = createTempDir("c2a-scan-io-off-");
    const filePath = path.join(root, "Example.java");
    writeFileSync(filePath, "class Example {}\n", "utf8");

    initScanIoCache({
      enabled: false,
      fileCacheMegabytes: 0,
      dirCacheEntries: 0,
      parseCacheEnabled: false,
      parseCacheJavaEntries: 0,
      parseCacheKotlinEntries: 0,
      parseCacheNodejsEntries: 0,
    });

    assert.equal(readScanUtf8File(filePath), "class Example {}\n");
    assert.deepEqual(listScanSourceFiles(root, ".java"), [filePath]);
  });
});

describe("scan-cache-options", () => {
  it("maps argv defaults to scan-io options", () => {
    const argv: ScanCommandCacheArgv = {
      cache: true,
      cacheFileMb: 256,
      cacheDirEntries: 10_000,
      cacheParse: true,
      cacheParseEntries: 8000,
    };

    assert.deepEqual(cacheArgvToScanIoOptions(argv), {
      enabled: true,
      fileCacheMegabytes: 256,
      dirCacheEntries: 10_000,
      parseCacheEnabled: true,
      parseCacheJavaEntries: 8000,
      parseCacheKotlinEntries: 4000,
      parseCacheNodejsEntries: 4000,
    });
  });

  it("disables all layers with --no-cache argv shape", () => {
    const argv: ScanCommandCacheArgv = {
      cache: false,
      cacheFileMb: 256,
      cacheDirEntries: 10_000,
      cacheParse: false,
      cacheParseEntries: 8000,
    };

    const options = cacheArgvToScanIoOptions(argv);
    assert.equal(options.enabled, false);
    assert.equal(options.parseCacheEnabled, false);
  });
});
