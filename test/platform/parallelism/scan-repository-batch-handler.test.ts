import assert from "node:assert/strict";
import { cpSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildCodeInventorySnapshot } from "../../../src/code-inventory/code-inventory-snapshot.js";
import { createMainThreadBridge } from "../../../src/platform/parallelism/main-thread-bridge.js";
import { runScanRepositoryBatchTask } from "../../../src/platform/parallelism/handlers/scan-handlers.js";
import { serializeDiscoverySnapshot } from "../../../src/platform/parallelism/snapshot-serialization.js";
import { setWorkerPhase } from "../../../src/platform/parallelism/worker-phase-context.js";
import {
  METRIC_FILES_CACHE_HIT,
  METRIC_FILES_PROCESSED,
  METRIC_WORKER_TASK_DURATION,
} from "../../../src/platform/profiling/metric-types.js";
import { getValue, initProfiling } from "../../../src/platform/profiling/index.js";
import { resetProfilingState } from "../../../src/platform/profiling/profiling-state.js";
import { initScanIoCache, resetScanIoCache, DEFAULT_SCAN_IO_CACHE_OPTIONS } from "../../../src/platform/scan-io/index.js";
import {
  initWorkerRuntime,
  resetWorkerRuntime,
} from "../../../src/platform/parallelism/worker-runtime.js";
import { createTestTempDir } from "../../test-temp-dir.js";
import "../../../src/platform/processors/builtin-processors.js";

const mavenProcessor = {
  groupId: "scan.extract.assembly.maven",
  artifactId: "modules-and-dependencies",
} as const;

const springWebMvcProcessor = {
  groupId: "scan.extract.rest.controllers",
  artifactId: "spring-webmvc",
} as const;

const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/jvm/rest/spring",
);

const SUPPLEMENTED_FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/jvm/rest/clients/supplemented",
);

const supplementedRestClientProcessor = {
  groupId: "scan.extract.rest.clients",
  artifactId: "supplemented-rest-clients",
} as const;

function copyFixtureTree(sourceDir: string, targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir)) {
    const sourcePath = path.join(sourceDir, entry);
    const targetPath = path.join(targetDir, entry);
    if (statSync(sourcePath).isDirectory()) {
      copyFixtureTree(sourcePath, targetPath);
      continue;
    }
    cpSync(sourcePath, targetPath);
  }
}

function setupMavenRepo(): { root: string; repositoryId: string; serialized: ReturnType<typeof serializeDiscoverySnapshot> } {
  const root = createTestTempDir("c2a-repo-batch-");
  const repoDir = path.join(root, "app");
  mkdirSync(repoDir, { recursive: true });
  writeFileSync(
    path.join(repoDir, "pom.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>app</artifactId>
  <version>1.0.0</version>
</project>`,
  );

  const snapshot = buildCodeInventorySnapshot({
    scanId: "scan-1",
    sourceRoot: root,
    sourceDirs: [root],
    repositoryCommonRoot: root,
    runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    entityArrays: {
      Repository: [
        {
          id: "repo-app",
          name: "app",
          namespace: "/app",
          localPath: repoDir,
          url: "",
          buildSystems: ["maven"],
        },
      ],
    },
  });

  return {
    root,
    repositoryId: "repo-app",
    serialized: serializeDiscoverySnapshot(snapshot),
  };
}

function setupSpringGradleRepo(): {
  root: string;
  repositoryId: string;
  serialized: ReturnType<typeof serializeDiscoverySnapshot>;
} {
  const root = createTestTempDir("c2a-repo-batch-spring-");
  writeFileSync(path.join(root, "settings.gradle"), `rootProject.name = 'demo'`);
  writeFileSync(
    path.join(root, "build.gradle"),
    `group = 'com.example'
version = '1.0.0'`,
  );
  const sourceDir = path.join(root, "src", "main", "java", "com", "example", "api");
  mkdirSync(sourceDir, { recursive: true });
  for (const fileName of ["UserController.java", "UserContract.java", "UserDto.java"]) {
    cpSync(path.join(FIXTURES_DIR, fileName), path.join(sourceDir, fileName));
  }

  const snapshot = buildCodeInventorySnapshot({
    scanId: "scan-1",
    sourceRoot: root,
    sourceDirs: [root],
    repositoryCommonRoot: root,
    runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    entityArrays: {
      Repository: [
        {
          id: "repo-app",
          name: "demo",
          namespace: "",
          localPath: root,
          url: "",
          buildSystems: ["gradle"],
        },
      ],
      ApplicationModule: [
        {
          id: "mod-demo",
          repositoryId: "repo-app",
          buildSystem: "gradle",
          groupId: "com.example",
          artifactId: "demo",
          version: "1.0.0",
          name: "demo",
          repoPath: "",
          buildScript: "build.gradle",
          isMultimodule: false,
        },
      ],
    },
  });

  return {
    root,
    repositoryId: "repo-app",
    serialized: serializeDiscoverySnapshot(snapshot),
  };
}

describe("runScanRepositoryBatchTask", () => {
  it("runs processors sequentially and reuses scan-io cache within batch", () => {
    const { repositoryId, serialized } = setupMavenRepo();
    initProfiling({ enabled: true });
    initScanIoCache(DEFAULT_SCAN_IO_CACHE_OPTIONS);
    const bridge = createMainThreadBridge(new Map());
    setWorkerPhase("scan.extract.assembly", serialized, "assembly");

    initWorkerRuntime({
      threadId: "worker-1",
      postEvent: (message) => bridge.dispatch(message),
      trackWorkerTaskMetrics: false,
    });

    try {
      const result = runScanRepositoryBatchTask({
        repositoryId,
        processors: [mavenProcessor, mavenProcessor],
        continueOnError: false,
      });

      const processorKey = `${mavenProcessor.groupId}/${mavenProcessor.artifactId}`;
      assert.ok(result.outputs[processorKey]);
      assert.equal(result.errors, undefined);

      const fileReads = getValue(METRIC_FILES_PROCESSED, [".xml"]) ?? 0;
      const readHits = getValue(METRIC_FILES_CACHE_HIT, ["read"]) ?? 0;
      assert.equal(fileReads, 1);
      assert.ok(readHits >= 1);
      assert.ok(
        (getValue(METRIC_WORKER_TASK_DURATION, [
          mavenProcessor.groupId,
          mavenProcessor.artifactId,
        ]) ?? 0) > 0,
      );
    } finally {
      resetWorkerRuntime();
      resetScanIoCache();
      resetProfilingState();
    }
  });

  it("collects per-processor errors when continueOnError is true", () => {
    const { repositoryId, serialized } = setupMavenRepo();
    setWorkerPhase("scan.extract.assembly", serialized, "assembly");
    const bridge = createMainThreadBridge(new Map());

    initWorkerRuntime({
      threadId: "worker-1",
      postEvent: (message) => bridge.dispatch(message),
      trackWorkerTaskMetrics: false,
    });

    try {
      const missingProcessor = {
        groupId: "scan.extract.assembly.maven",
        artifactId: "missing-artifact",
      };
      const result = runScanRepositoryBatchTask({
        repositoryId,
        processors: [mavenProcessor, missingProcessor],
        continueOnError: true,
      });

      const mavenKey = `${mavenProcessor.groupId}/${mavenProcessor.artifactId}`;
      const missingKey = `${missingProcessor.groupId}/${missingProcessor.artifactId}`;
      assert.ok(result.outputs[mavenKey]);
      assert.ok(result.errors?.[missingKey]);
      assert.match(result.errors?.[missingKey]?.message ?? "", /Processor not found/);
    } finally {
      resetWorkerRuntime();
    }
  });

  it("throws on first processor error when continueOnError is false", () => {
    const { repositoryId, serialized } = setupMavenRepo();
    setWorkerPhase("scan.extract.assembly", serialized, "assembly");
    const bridge = createMainThreadBridge(new Map());

    initWorkerRuntime({
      threadId: "worker-1",
      postEvent: (message) => bridge.dispatch(message),
      trackWorkerTaskMetrics: false,
    });

    try {
      assert.throws(
        () =>
          runScanRepositoryBatchTask({
            repositoryId,
            processors: [
              {
                groupId: "scan.extract.assembly.maven",
                artifactId: "missing-artifact",
              },
            ],
            continueOnError: false,
          }),
        /Processor not found/,
      );
    } finally {
      resetWorkerRuntime();
    }
  });

  it("discovers REST controllers in module-source phase with ApplicationModule snapshot", () => {
    const { repositoryId, serialized } = setupSpringGradleRepo();
    initScanIoCache(DEFAULT_SCAN_IO_CACHE_OPTIONS);
    const bridge = createMainThreadBridge(new Map());
    setWorkerPhase("scan.extract.module-source", serialized, "module-source");

    initWorkerRuntime({
      threadId: "worker-1",
      postEvent: (message) => bridge.dispatch(message),
      trackWorkerTaskMetrics: false,
    });

    try {
      const result = runScanRepositoryBatchTask({
        repositoryId,
        processors: [springWebMvcProcessor],
        continueOnError: false,
      });

      const processorKey = `${springWebMvcProcessor.groupId}/${springWebMvcProcessor.artifactId}`;
      const output = result.outputs[processorKey];
      assert.ok(output);
      assert.equal(output.entities?.RestController?.length, 1);
      assert.equal(output.entities?.RestController?.[0]?.simpleName, "UserController");
    } finally {
      resetWorkerRuntime();
      resetScanIoCache();
    }
  });

  it("delivers rest-clients.json supplement via phase and discovers consuming-module clients", () => {
    const root = createTestTempDir("c2a-repo-batch-suppl-");
    writeFileSync(path.join(root, "settings.gradle"), `rootProject.name = 'demo'`);
    writeFileSync(
      path.join(root, "build.gradle"),
      `group = 'com.example'\nversion = '1.0.0'`,
    );
    copyFixtureTree(
      path.join(SUPPLEMENTED_FIXTURES_DIR, "java"),
      path.join(root, "src", "main", "java"),
    );

    const supplementPath = path.join(root, "rest-clients.json");
    writeFileSync(
      supplementPath,
      JSON.stringify([
        {
          fqcn: "com.example.client.PaymentFeignClient",
          applicationModuleId: "origin-module-123",
          simpleName: "PaymentFeignClient",
          fileName: "client/src/main/java/com/example/client/PaymentFeignClient.java",
          endpoints: [],
          contractIds: [],
          dataTypeIds: [],
        },
      ]),
      "utf8",
    );

    const snapshot = buildCodeInventorySnapshot({
      scanId: "scan-1",
      sourceRoot: root,
      sourceDirs: [root],
      repositoryCommonRoot: root,
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
      entityArrays: {
        Repository: [
          {
            id: "repo-app",
            name: "demo",
            namespace: "",
            localPath: root,
            url: "",
            buildSystems: ["gradle"],
          },
        ],
        ApplicationModule: [
          {
            id: "mod-demo",
            repositoryId: "repo-app",
            buildSystem: "gradle",
            groupId: "com.example",
            artifactId: "demo",
            version: "1.0.0",
            name: "demo",
            repoPath: "",
            buildScript: "build.gradle",
            isMultimodule: false,
          },
        ],
      },
    });
    const serialized = serializeDiscoverySnapshot(snapshot);

    const supplementCatalog = {
      declarations: [
        {
          target: "scan.extract.rest.clients.supplemented-rest-clients",
          paths: [{ path: supplementPath, basename: "rest-clients.json" }],
        },
      ],
    };
    setWorkerPhase("scan.extract.module-source", serialized, "module-source", supplementCatalog);
    const bridge = createMainThreadBridge(new Map());

    initWorkerRuntime({
      threadId: "worker-1",
      postEvent: (message) => bridge.dispatch(message),
      trackWorkerTaskMetrics: false,
    });

    try {
      const result = runScanRepositoryBatchTask({
        repositoryId: "repo-app",
        processors: [supplementedRestClientProcessor],
        continueOnError: false,
      });

      const processorKey =
        `${supplementedRestClientProcessor.groupId}/${supplementedRestClientProcessor.artifactId}`;
      const output = result.outputs[processorKey];
      assert.ok(output);
      const client = (output.entities?.RestClient as
        | Array<{ fqcn: string; simpleName?: string; applicationModuleId?: string }>
        | undefined)?.find((item) => item.fqcn === "com.example.client.PaymentFeignClient");
      assert.ok(client);
      assert.equal(client.simpleName, "PaymentFeignClient");
      assert.equal(client.applicationModuleId, "mod-demo");
    } finally {
      resetWorkerRuntime();
    }
  });
});
