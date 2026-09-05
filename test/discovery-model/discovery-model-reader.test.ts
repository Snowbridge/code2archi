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
            extractProcessor: "scan.scope:git-repositories",
            extractSchema: "0.2.5",
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
    assert.equal(snapshot.getById("repo-id")?.localPath, "/repo");
    assert.deepEqual(snapshot.listLinks("DirectRestRequestsServingMatch"), []);
  });

  it("indexes entities loaded from disk for ref lookups", () => {
    const tempDir = createTestTempDir("c2a-discovery-reader-index-");
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
            {
              path: "application-modules.json",
              contentType: "entities",
              entityType: "ApplicationModule",
            },
            {
              path: "application-module-dependencies.json",
              contentType: "entities",
              entityType: "ApplicationModuleDependency",
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
      `${JSON.stringify([{ id: "repo-id", name: "repo" }], null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      path.join(tempDir, "application-modules.json"),
      `${JSON.stringify(
        [{ id: "module-a", repositoryId: "repo-id", name: "module-a" }],
        null,
        2,
      )}\n`,
      "utf8",
    );
    writeFileSync(
      path.join(tempDir, "application-module-dependencies.json"),
      `${JSON.stringify(
        [
          {
            id: "dep-1",
            parentId: "module-a",
            groupId: "com.example",
            artifactId: "lib",
            version: "1.0.0",
          },
        ],
        null,
        2,
      )}\n`,
      "utf8",
    );

    const snapshot = new DiscoveryModelReader().read(tempDir);

    assert.deepEqual(
      snapshot.listEntitiesByRef("ApplicationModuleDependency", "parentId", "module-a").map(
        (entity) => entity.id,
      ),
      ["dep-1"],
    );
    assert.deepEqual(
      snapshot.listEntitiesByRef("ApplicationModule", "repositoryId", "repo-id").map(
        (entity) => entity.id,
      ),
      ["module-a"],
    );
  });

  it("throws when manifest is missing", () => {
    const tempDir = createTestTempDir("c2a-discovery-reader-missing-");
    assert.throws(() => new DiscoveryModelReader().read(tempDir), /manifest not found/);
  });
});
