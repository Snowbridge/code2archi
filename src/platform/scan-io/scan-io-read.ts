import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { recordProcessedFile } from "../profiling/helpers.js";
import { getScanIoCacheState } from "./scan-io-cache.js";
import { recordScanIoCacheHit, recordScanIoCacheMiss } from "./scan-io-metrics.js";

function walkSourceFiles(rootDir: string, extension: string): string[] {
  const files: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) {
      continue;
    }

    let entries;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(extension)) {
        files.push(absolutePath);
      }
    }
  }

  return files;
}

export function readScanUtf8File(absolutePath: string): string {
  const cacheState = getScanIoCacheState();
  const options = cacheState.options;

  if (!options.enabled || options.fileCacheMegabytes === 0) {
    recordProcessedFile(absolutePath);
    return readFileSync(absolutePath, "utf8");
  }

  const cached = cacheState.fileCache.get(absolutePath);
  if (cached !== undefined) {
    recordScanIoCacheHit("read");
    return cached;
  }

  recordScanIoCacheMiss("read");
  recordProcessedFile(absolutePath);
  const content = readFileSync(absolutePath, "utf8");
  const sizeBytes = Buffer.byteLength(content, "utf8");
  cacheState.fileCache.set(absolutePath, content, sizeBytes);
  return content;
}

export function listScanSourceFiles(rootDir: string, extension: string): readonly string[] {
  const cacheState = getScanIoCacheState();
  const options = cacheState.options;
  const cacheKey = `${rootDir}:${extension}`;

  if (!options.enabled || options.dirCacheEntries === 0) {
    return walkSourceFiles(rootDir, extension);
  }

  const cached = cacheState.dirCache.get(cacheKey);
  if (cached !== undefined) {
    recordScanIoCacheHit("dir");
    return cached;
  }

  recordScanIoCacheMiss("dir");
  const files = walkSourceFiles(rootDir, extension);
  cacheState.dirCache.set(cacheKey, files);
  return files;
}
