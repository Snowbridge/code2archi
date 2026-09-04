import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { archiModelDomOutputPath } from "../../src/archimate-model/archi-model-dom-writer.js";
import { Repository } from "../../src/discovery-model/entities/repository.js";
import { REPOSITORY_SCHEMA_ID } from "../../src/discovery-model/discovery-model-writer.js";
import { runGenerateFlow } from "../../src/generate/run-generate-flow.js";
import { validateGenerateArgs } from "../../src/generate/validate-generate-args.js";
import type { GlobalArgv } from "../../src/cli/processor-groups.js";
import { initLogging, resetLoggingForTests } from "../../src/platform/logging/index.js";
import "../../src/platform/processors/builtin-processors.js";
import { createTestTempDir } from "../test-temp-dir.js";
import { testParallelismOptions } from "../parallelism-test-defaults.js";

const defaultValidateArgs = { force: false, noDecorate: false };

function emptyGlobalArgv(): GlobalArgv {
  return {
    logLevel: "INFO",
    verbose: false,
    profile: false,
    threads: 1,
    sync: false,
    continueOnError: false,
    with: [],
    without: [],
    withOnly: [],
  };
}

function writeDiscoveryManifest(
  discoveryDir: string,
  tempDir: string,
  repositories: ReturnType<Repository["toCreateIntent"]>[] = [],
): void {
  writeFileSync(
    path.join(discoveryDir, "manifest.json"),
    `${JSON.stringify(
      {
        formatVersion: "0.2.5",
        scanId: "scan-1",
        scannedAt: "2026-08-30T12:15:24.335+03:00",
        sourceRoot: tempDir,
        collections:
          repositories.length > 0
            ? [
                {
                  path: "repositories.json",
                  contentType: "entities",
                  entityType: "Repository",
                  schema: REPOSITORY_SCHEMA_ID,
                },
              ]
            : [],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  if (repositories.length > 0) {
    writeFileSync(
      path.join(discoveryDir, "repositories.json"),
      `${JSON.stringify(repositories, null, 2)}\n`,
      "utf8",
    );
  }
}

describe("runGenerateFlow", () => {
  it("writes bootstrap archimate model from discovery-model", () => {
    const tempDir = createTestTempDir("c2a-generate-flow-");
    const discoveryDir = path.join(tempDir, "discovery");
    mkdirSync(discoveryDir, { recursive: true });
    const outputFile = path.join(tempDir, "model.archimate");

    writeDiscoveryManifest(discoveryDir, tempDir);

    initLogging({ logLevel: "INFO", verbose: false, logDirectory: createTestTempDir("c2a-log-") });
    try {
      const generateArgs = validateGenerateArgs({
        outputFile,
        discoveryModelDir: discoveryDir,
        ...defaultValidateArgs,
      });

      runGenerateFlow({
        ...generateArgs,
        verbose: false,
        profile: false,
        parallelism: testParallelismOptions,
        processorFilters: {
          with: [],
          without: [],
          withOnly: [],
        },
      });
    } finally {
      resetLoggingForTests();
    }

    const xml = readFileSync(outputFile, "utf8");
    assert.match(xml, /<archimate:model/);
    assert.match(xml, /<folder name="Business"/);
    assert.match(xml, /<folder name="Views"/);
    assert.equal(existsSync(archiModelDomOutputPath(outputFile)), false);
  });

  it("writes dom json alongside archimate when log level is DEBUG", () => {
    const tempDir = createTestTempDir("c2a-generate-flow-debug-");
    const discoveryDir = path.join(tempDir, "discovery");
    mkdirSync(discoveryDir, { recursive: true });
    const outputFile = path.join(tempDir, "model.archimate");
    const domFile = archiModelDomOutputPath(outputFile);

    writeDiscoveryManifest(discoveryDir, tempDir);

    initLogging({ logLevel: "DEBUG", verbose: false, logDirectory: createTestTempDir("c2a-log-") });
    try {
      const generateArgs = validateGenerateArgs({
        outputFile,
        discoveryModelDir: discoveryDir,
        ...defaultValidateArgs,
      });

      runGenerateFlow({
        ...generateArgs,
        verbose: false,
        profile: false,
        parallelism: testParallelismOptions,
        processorFilters: {
          with: [],
          without: [],
          withOnly: [],
        },
      });
    } finally {
      resetLoggingForTests();
    }

    assert.equal(existsSync(domFile), true);
    const dom = JSON.parse(readFileSync(domFile, "utf8")) as {
      modelName: string;
      folders: unknown[];
      elements: unknown[];
      relations: unknown[];
    };
    assert.equal(typeof dom.modelName, "string");
    assert.ok(dom.folders.length >= 5);
    assert.ok(Array.isArray(dom.elements));
    assert.ok(Array.isArray(dom.relations));
  });

  it("writes repository artifacts from discovery-model repositories", () => {
    const tempDir = createTestTempDir("c2a-generate-flow-repos-");
    const discoveryDir = path.join(tempDir, "discovery");
    mkdirSync(discoveryDir, { recursive: true });
    const outputFile = path.join(tempDir, "model.archimate");
    const repositoryRecord = {
      ...new Repository({
        url: "https://example.com/flow-app.git",
        localPath: path.join(tempDir, "flow-app"),
        name: "flow-app",
        namespace: "",
        buildSystems: ["maven"],
      }).toCreateIntent(),
      scannerExtractor: "scan.scope:git-repositories",
      scannerSchema: "0.2.6",
      extractedAt: "2026-08-30T12:15:24.335+03:00",
    };

    writeDiscoveryManifest(discoveryDir, tempDir, [repositoryRecord]);

    initLogging({ logLevel: "INFO", verbose: false, logDirectory: createTestTempDir("c2a-log-") });
    try {
      const generateArgs = validateGenerateArgs({
        outputFile,
        discoveryModelDir: discoveryDir,
        ...defaultValidateArgs,
      });

      runGenerateFlow({
        ...generateArgs,
        verbose: false,
        profile: false,
        parallelism: testParallelismOptions,
        processorFilters: {
          with: [],
          without: [],
          withOnly: [],
        },
      });
    } finally {
      resetLoggingForTests();
    }

    const xml = readFileSync(outputFile, "utf8");
    assert.match(xml, /<folder name="Code repositories"/);
    assert.match(xml, /xsi:type="archimate:Artifact"/);
    assert.match(xml, /name="flow-app\.git"/);
    assert.match(xml, /<property key="c2a:url" value="https:\/\/example\.com\/flow-app\.git"\/>/);
  });

  it("keeps raw repository names when no-decorate is enabled", () => {
    const tempDir = createTestTempDir("c2a-generate-flow-no-decorate-");
    const discoveryDir = path.join(tempDir, "discovery");
    mkdirSync(discoveryDir, { recursive: true });
    const outputFile = path.join(tempDir, "model.archimate");
    const repositoryRecord = {
      ...new Repository({
        url: "https://example.com/flow-app.git",
        localPath: path.join(tempDir, "flow-app"),
        name: "flow-app",
        namespace: "",
        buildSystems: ["maven"],
      }).toCreateIntent(),
      scannerExtractor: "scan.scope:git-repositories",
      scannerSchema: "0.2.6",
      extractedAt: "2026-08-30T12:15:24.335+03:00",
    };

    writeDiscoveryManifest(discoveryDir, tempDir, [repositoryRecord]);

    initLogging({ logLevel: "INFO", verbose: false, logDirectory: createTestTempDir("c2a-log-") });
    try {
      const generateArgs = validateGenerateArgs({
        outputFile,
        discoveryModelDir: discoveryDir,
        force: false,
        noDecorate: true,
      });

      runGenerateFlow({
        ...generateArgs,
        verbose: false,
        profile: false,
        parallelism: testParallelismOptions,
        processorFilters: {
          with: [],
          without: [],
          withOnly: [],
        },
      });
    } finally {
      resetLoggingForTests();
    }

    const xml = readFileSync(outputFile, "utf8");
    assert.match(xml, /name="flow-app"/);
    assert.doesNotMatch(xml, /name="flow-app\.git"/);
  });
});
