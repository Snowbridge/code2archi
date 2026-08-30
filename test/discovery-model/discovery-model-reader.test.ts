import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { DiscoveryModelReader } from "../../src/discovery-model/discovery-model-reader.js";
import { createTestTempDir } from "../test-temp-dir.js";

describe("DiscoveryModelReader", () => {
  it("loads manifest and entity collections", () => {
    const tempDir = createTestTempDir("c2a-discovery-reader-");
    writeFileSync(
      path.join(tempDir, "manifest.json"),
      `${JSON.stringify(
        {
          formatVersion: "0.2.5",
          scanId: "scan-1",
          scannedAt: "2026-08-30T12:15:24.335+03:00",
          sourceRoot: "/repo",
          collections: [
            {
              path: "repositories.json",
              contentType: "entities",
              entityType: "Repository",
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    writeFileSync(
      path.join(tempDir, "repositories.json"),
      `${JSON.stringify(
        [
          {
            id: "repo-id",
            url: "https://example.com/repo.git",
            localPath: "/repo",
            scannerExtractor: "scan.scope:git-repos",
            scannerSchema: "0.2.5",
            extractedAt: "2026-08-30T12:15:24.335+03:00",
          },
        ],
        null,
        2,
      )}\n`,
      "utf8",
    );

    const snapshot = new DiscoveryModelReader().read(tempDir);

    assert.equal(snapshot.scanId, "scan-1");
    assert.equal(snapshot.sourceRoot, "/repo");
    assert.equal(snapshot.listEntities("Repository").length, 1);
    assert.equal(snapshot.getEntity("Repository", "repo-id")?.localPath, "/repo");
  });

  it("throws when manifest is missing", () => {
    const tempDir = createTestTempDir("c2a-discovery-reader-missing-");
    assert.throws(() => new DiscoveryModelReader().read(tempDir), /manifest not found/);
  });
});
