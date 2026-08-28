import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import "../../src/platform/processors/builtin-processors.js";
import {
  APPLICATION_MODULE_DEPENDENCY_SCHEMA_ID,
  APPLICATION_MODULE_SCHEMA_ID,
  REPOSITORY_SCHEMA_ID,
} from "../../src/discovery-model/discovery-model-writer.js";
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

  it("writes application modules after scan-app for maven repository", () => {
    const root = createTestTempDir("c2a-scan-flow-maven-");
    const sourceDir = path.join(root, "src");
    const outputDir = path.join(root, "out");
    mkdirSync(sourceDir);
    mkdirSync(outputDir);
    writeFileSync(
      path.join(sourceDir, "pom.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.flow</groupId>
  <artifactId>flow-app</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>com.lib</groupId>
      <artifactId>shared</artifactId>
      <version>1.0.0</version>
    </dependency>
  </dependencies>
</project>`,
    );

    runScanFlow({
      sourceDirs: [sourceDir],
      outputDir,
      force: false,
      scanId: "test-scan-maven",
      runStartedAt: new Date("2026-08-27T09:00:00.000Z"),
      processorFilters: {
        withNone: [],
        without: {},
        with: { "scan-scope": ["unversioned-folders"] },
        withOnly: {},
      },
    });

    const modulesPath = path.join(outputDir, "application-modules.json");
    const dependenciesPath = path.join(outputDir, "application-module-dependencies.json");
    assert.ok(existsSync(modulesPath));
    assert.ok(existsSync(dependenciesPath));

    const manifest = JSON.parse(readFileSync(path.join(outputDir, "manifest.json"), "utf8")) as {
      collections: Array<{ path: string; schema: string }>;
    };
    assert.ok(
      manifest.collections.some(
        (collection) =>
          collection.path === "application-modules.json" &&
          collection.schema === APPLICATION_MODULE_SCHEMA_ID,
      ),
    );
    assert.ok(
      manifest.collections.some(
        (collection) =>
          collection.path === "application-module-dependencies.json" &&
          collection.schema === APPLICATION_MODULE_DEPENDENCY_SCHEMA_ID,
      ),
    );

    const modules = JSON.parse(readFileSync(modulesPath, "utf8")) as Array<{
      artifactId: string;
      buildSystem: string;
    }>;
    const dependencies = JSON.parse(readFileSync(dependenciesPath, "utf8")) as Array<{
      artifactId: string;
    }>;
    assert.equal(modules.length, 1);
    assert.equal(modules[0]?.artifactId, "flow-app");
    assert.equal(modules[0]?.buildSystem, "maven");
    assert.equal(dependencies.length, 1);
    assert.equal(dependencies[0]?.artifactId, "shared");
  });
});
