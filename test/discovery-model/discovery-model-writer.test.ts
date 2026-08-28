import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { DiscoveryModelWriter } from "../../src/discovery-model/discovery-model-writer.js";
import { REPOSITORY_SCHEMA_ID } from "../../src/discovery-model/schema-ids.js";
import { packageVersion } from "../../src/package-version.js";
import { createTestTempDir } from "../test-temp-dir.js";

describe("DiscoveryModelWriter", () => {
  it("writes manifest.json and repositories.json", () => {
    const root = createTestTempDir("c2a-dm-writer-");
    const outputDir = path.join(root, "out");
    const sourceDir = path.join(root, "src");
    mkdirSync(outputDir);
    mkdirSync(sourceDir);

    const repositories = [
      {
        id: "repo-1",
        name: "src",
        namespace: "/src",
        localPath: sourceDir,
        url: "",
        buildSystems: [] as string[],
      },
    ];
    const scannedAt = new Date("2026-08-27T12:00:00.000Z");

    new DiscoveryModelWriter().write({
      outputDir,
      sourceDirs: [sourceDir],
      repositories,
      scanId: "scan-1",
      scannedAt,
    });

    const manifestPath = path.join(outputDir, "manifest.json");
    const repositoriesPath = path.join(outputDir, "repositories.json");
    assert.ok(existsSync(manifestPath));
    assert.ok(existsSync(repositoriesPath));

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      formatVersion: string;
      scanId: string;
      scannedAt: string;
      sourceRoot: string;
      collections: Array<{
        path: string;
        contentType: string;
        entityType: string;
        schema: string;
      }>;
    };

    assert.equal(manifest.formatVersion, packageVersion);
    assert.equal(manifest.scanId, "scan-1");
    assert.equal(manifest.scannedAt, scannedAt.toISOString());
    assert.equal(manifest.sourceRoot, path.resolve(sourceDir));
    assert.equal(manifest.collections.length, 1);
    assert.equal(manifest.collections[0]?.path, "repositories.json");
    assert.equal(manifest.collections[0]?.contentType, "entities");
    assert.equal(manifest.collections[0]?.entityType, "Repository");
    assert.equal(manifest.collections[0]?.schema, REPOSITORY_SCHEMA_ID);

    const writtenRepositories = JSON.parse(
      readFileSync(repositoriesPath, "utf8"),
    );
    assert.deepEqual(writtenRepositories, repositories);
  });

  it("uses common path prefix as sourceRoot for multiple source dirs", () => {
    const root = createTestTempDir("c2a-dm-prefix-");
    const outputDir = path.join(root, "out");
    const first = path.join(root, "mono", "first");
    const second = path.join(root, "mono", "second");
    mkdirSync(outputDir);
    mkdirSync(first, { recursive: true });
    mkdirSync(second, { recursive: true });

    new DiscoveryModelWriter().write({
      outputDir,
      sourceDirs: [first, second],
      repositories: [],
      scanId: "scan-2",
      scannedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    const manifest = JSON.parse(
      readFileSync(path.join(outputDir, "manifest.json"), "utf8"),
    ) as { sourceRoot: string };

    assert.equal(manifest.sourceRoot, path.resolve(root, "mono"));
  });
});
