import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { DEFAULT_SCAN_IO_CACHE_OPTIONS } from "../../../src/platform/scan-io/scan-io-options.js";
import {
  initScanIoCache,
  parseScanJavaFile,
  readScanUtf8File,
  resetScanIoCache,
} from "../../../src/platform/scan-io/index.js";

afterEach(() => {
  resetScanIoCache();
});

describe("scan-io parse cache", () => {
  it("reuses parsed Java AST without re-reading the file", () => {
    const root = mkdtempSync(path.join(tmpdir(), "c2a-scan-io-parse-"));
    const filePath = path.join(root, "Example.java");
    writeFileSync(filePath, "package demo;\npublic class Example {}\n", "utf8");

    initScanIoCache({
      ...DEFAULT_SCAN_IO_CACHE_OPTIONS,
      parseCacheJavaEntries: 10,
    });

    const first = parseScanJavaFile(filePath);
    const second = parseScanJavaFile(filePath);

    assert.equal(second, first);
    assert.equal(readScanUtf8File(filePath), "package demo;\npublic class Example {}\n");
  });
});
