import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import "../../src/platform/processors/builtin-processors.js";
import { REPOSITORY_SCHEMA_ID } from "../../src/discovery-model/schema-ids.js";
import { packageVersion } from "../../src/package-version.js";
import { runScanFlow } from "../../src/scan/run-scan-flow.js";
import { createTestTempDir } from "../test-temp-dir.js";

describe("runScanFlow", () => {
  it("writes discovery-model after scan-scope", () => {
    const root = createTestTempDir("c2a-scan-flow-");
    const sourceDir = path.join(root, "src");
    const outputDir = path.join(root, "out");
    mkdirSync(sourceDir);
    mkdirSync(outputDir);

    runScanFlow({
      sourceDirs: [sourceDir],
      outputDir,
      force: false,
      scanId: "test-scan-id",
      runStartedAt: new Date("2026-08-27T09:00:00.000Z"),
      processorFilters: {
        withNone: [],
        without: {},
        with: { "scan-scope": ["unversioned-folders"] },
        withOnly: {},
      },
    });

    const manifestPath = path.join(outputDir, "manifest.json");
    const repositoriesPath = path.join(outputDir, "repositories.json");
    assert.ok(existsSync(manifestPath));
    assert.ok(existsSync(repositoriesPath));

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      formatVersion: string;
      scanId: string;
      collections: Array<{ path: string; schema: string }>;
    };
    assert.equal(manifest.formatVersion, packageVersion);
    assert.equal(manifest.scanId, "test-scan-id");
    assert.equal(manifest.collections[0]?.path, "repositories.json");
    assert.equal(manifest.collections[0]?.schema, REPOSITORY_SCHEMA_ID);

    const repositories = JSON.parse(readFileSync(repositoriesPath, "utf8")) as Array<{
      name: string;
    }>;
    assert.equal(repositories.length, 1);
    assert.equal(repositories[0]?.name, "src");
  });
});
