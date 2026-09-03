import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { DiscoveryModelWriter } from "../../src/discovery-model/discovery-model-writer.js";
import { RunEntityStore } from "../../src/discovery-model/run-entity-store.js";
import { REPOSITORY_SCHEMA_ID, REST_CLIENT_SCHEMA_ID } from "../../src/discovery-model/discovery-model-writer.js";
import { packageVersion } from "../../src/package-version.js";
import { createTestTempDir } from "../test-temp-dir.js";

const GIT_REPOS_PROCESSOR = {
  groupId: "scan.scope",
  artifactId: "git-repositories",
};

const SCAN_SOURCE_PROCESSOR = {
  groupId: "scan.source",
  artifactId: "test-processor",
};

describe("DiscoveryModelWriter", () => {
  const previousTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Etc/GMT-3";
  });

  afterEach(() => {
    if (previousTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTz;
    }
  });

  it("writes manifest.json and repositories.json from run entity store", () => {
    const root = createTestTempDir("c2a-dm-writer-");
    const outputDir = path.join(root, "out");
    const sourceDir = path.join(root, "src");
    mkdirSync(outputDir);
    mkdirSync(sourceDir);

    const scannedAt = new Date("2026-08-27T12:00:00.000Z");
    const store = new RunEntityStore({
      sourceDirs: [sourceDir],
      scanId: "scan-1",
      runStartedAt: scannedAt,
    });
    store.addCreateIntents(
      "scan.scope",
      GIT_REPOS_PROCESSOR,
      {
        entities: {
          Repository: [
            {
              id: "repo-1",
              name: "src",
              namespace: "/src",
              localPath: sourceDir,
              url: "",
              buildSystems: [],
            },
          ],
        },
      },
      scannedAt,
    );

    new DiscoveryModelWriter().write({
      outputDir,
      store,
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
    assert.equal(manifest.scannedAt, "2026-08-27T15:00:00.000+03:00");
    assert.equal(manifest.sourceRoot, path.resolve(sourceDir));
    assert.equal(manifest.collections.length, 1);
    assert.equal(manifest.collections[0]?.path, "repositories.json");
    assert.equal(manifest.collections[0]?.contentType, "entities");
    assert.equal(manifest.collections[0]?.entityType, "Repository");
    assert.equal(manifest.collections[0]?.schema, REPOSITORY_SCHEMA_ID);

    const writtenRepositories = JSON.parse(
      readFileSync(repositoriesPath, "utf8"),
    ) as Array<{
      id: string;
      scannerExtractor: string;
      scannerSchema: string;
      extractedAt: string;
    }>;
    assert.equal(writtenRepositories.length, 1);
    assert.equal(writtenRepositories[0]?.scannerExtractor, "scan.scope:git-repositories");
    assert.equal(writtenRepositories[0]?.scannerSchema, packageVersion);
    assert.equal(writtenRepositories[0]?.extractedAt, "2026-08-27T15:00:00.000+03:00");
  });

  it("uses common path prefix as sourceRoot for multiple source dirs", () => {
    const root = createTestTempDir("c2a-dm-prefix-");
    const outputDir = path.join(root, "out");
    const first = path.join(root, "mono", "first");
    const second = path.join(root, "mono", "second");
    mkdirSync(outputDir);
    mkdirSync(first, { recursive: true });
    mkdirSync(second, { recursive: true });

    const store = new RunEntityStore({
      sourceDirs: [first, second],
      scanId: "scan-2",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    new DiscoveryModelWriter().write({
      outputDir,
      store,
      scannedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    const manifest = JSON.parse(
      readFileSync(path.join(outputDir, "manifest.json"), "utf8"),
    ) as { sourceRoot: string; collections: unknown[] };

    assert.equal(manifest.sourceRoot, path.resolve(root, "mono"));
    assert.deepEqual(manifest.collections, []);
  });

  it("skips entity types without schema even when present in store", () => {
    const root = createTestTempDir("c2a-dm-no-schema-");
    const outputDir = path.join(root, "out");
    mkdirSync(outputDir);

    const store = new RunEntityStore({
      sourceDirs: [path.join(root, "src")],
      scanId: "scan-3",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });
    store.addCreateIntents("scan.source", SCAN_SOURCE_PROCESSOR, {
      entities: {
        BuildScript: [{ id: "bs-1", name: "build.gradle" }],
      },
    });

    new DiscoveryModelWriter().write({
      outputDir,
      store,
      scannedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    assert.ok(!existsSync(path.join(outputDir, "build-scripts.json")));
  });

  it("writes rest-clients.json when RestClient entities are present", () => {
    const root = createTestTempDir("c2a-dm-rest-client-");
    const outputDir = path.join(root, "out");
    mkdirSync(outputDir);

    const store = new RunEntityStore({
      sourceDirs: [path.join(root, "src")],
      scanId: "scan-rest-client",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });
    store.addCreateIntents("scan.source", SCAN_SOURCE_PROCESSOR, {
      entities: {
        RestClient: [
          {
            id: "client-1",
            applicationModuleId: "module-1",
            name: "OrderFeignClient",
            fqcn: "com.example.OrderFeignClient",
            dtoFqcn: [],
            endpoints: ["GET /api/orders/:id"],
            tcpStackType: "BLOCKING",
            discoveryStyle: "DECLARATIVE",
            clientFramework: "feign",
            extendedInterfaceFqcn: [],
            sourceFile: "src/main/java/com/example/OrderFeignClient.java",
          },
        ],
      },
    });

    new DiscoveryModelWriter().write({
      outputDir,
      store,
      scannedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    const clientsPath = path.join(outputDir, "rest-clients.json");
    assert.ok(existsSync(clientsPath));

    const manifest = JSON.parse(
      readFileSync(path.join(outputDir, "manifest.json"), "utf8"),
    ) as { collections: Array<{ path: string; entityType: string; schema: string }> };
    const restClientCollection = manifest.collections.find(
      (entry) => entry.entityType === "RestClient",
    );
    assert.equal(restClientCollection?.path, "rest-clients.json");
    assert.equal(restClientCollection?.schema, REST_CLIENT_SCHEMA_ID);

    const clients = JSON.parse(readFileSync(clientsPath, "utf8")) as Array<{ name: string }>;
    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "OrderFeignClient");
  });
});
