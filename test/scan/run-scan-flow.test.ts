import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import "../../src/platform/processors/builtin-processors.js";
import { CliError } from "../../src/cli/cli-error.js";
import { ExitCode } from "../../src/cli/exit-codes.js";
import {
  APPLICATION_MODULE_DEPENDENCY_SCHEMA_ID,
  APPLICATION_MODULE_SCHEMA_ID,
  REPOSITORY_SCHEMA_ID,
  REST_CONTROLLER_SCHEMA_ID,
} from "../../src/code-inventory/code-inventory-writer.js";
import { packageVersion } from "../../src/package-version.js";
import { runScanFlow } from "../../src/scan/run-scan-flow.js";
import {
  AbstractProcessor,
  type ScanScopeInput,
  type ScanScopeOutput,
} from "../../src/platform/processors/processor.js";
import { processorRegistry } from "../../src/platform/processors/processor-registry.js";
import { finalizeProfiling, initProfiling } from "../../src/platform/profiling/index.js";
import { resetProfilingState } from "../../src/platform/profiling/profiling-state.js";
import { createTestTempDir } from "../test-temp-dir.js";
import { testParallelismOptions, testParallelismContinueOnError, testParallelismWorkerPoolOptions } from "../parallelism-test-defaults.js";

const SPRING_FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/jvm/rest/spring",
);

const FAILING_SCOPE_ARTIFACT = "test-flow-failing";

class FailingScopeProcessor extends AbstractProcessor<ScanScopeInput, ScanScopeOutput> {
  readonly id = { groupId: "scan.scope", artifactId: FAILING_SCOPE_ARTIFACT };
  readonly version = "0.0.0";
  readonly executionPolicy = "ALWAYS" as const;
  readonly description = "Failing processor for continue-on-error tests.";

  protected doProcess(): ScanScopeOutput {
    throw new Error("deliberate scope failure");
  }
}

function createGitRepo(dir: string): void {
  mkdirSync(path.join(dir, ".git"), { recursive: true });
}

describe("runScanFlow", async () => {
  it("writes code-inventory after scan.scope", async () => {
    const root = createTestTempDir("c2a-scan-flow-");
    const sourceDir = path.join(root, "src");
    const outputDir = path.join(root, "out");
    mkdirSync(sourceDir);
    mkdirSync(outputDir);

    await runScanFlow({
      sourceDirs: [sourceDir],
      outputDir,
      force: false,
      scanId: "test-scan-id",
      runStartedAt: new Date("2026-08-27T09:00:00.000Z"),
      verbose: false,
      profile: false,
      parallelism: testParallelismOptions,
      processorFilters: {
        with: ["scan.scope.unversioned-folders"],
        without: [],
        withOnly: [],
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
    assert.equal(repositories[0]?.namespace, "");
  });

  it("finalizes repository namespace from common root before scan.extract", async () => {
    const root = createTestTempDir("c2a-scan-flow-ns-");
    const sourceDir = path.join(root, "fizz");
    const repoDir = path.join(sourceDir, "fuzz", "bar", "buzz", "flow-app");
    const secondRepoDir = path.join(sourceDir, "other", "second-app");
    const outputDir = path.join(root, "out");
    mkdirSync(repoDir, { recursive: true });
    mkdirSync(secondRepoDir, { recursive: true });
    mkdirSync(outputDir);
    createGitRepo(repoDir);
    createGitRepo(secondRepoDir);
    writeFileSync(
      path.join(repoDir, "pom.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.flow</groupId>
  <artifactId>flow-app</artifactId>
  <version>1.0.0</version>
</project>`,
    );

    await runScanFlow({
      sourceDirs: [sourceDir],
      outputDir,
      force: false,
      scanId: "test-scan-namespace",
      runStartedAt: new Date("2026-08-27T09:00:00.000Z"),
      verbose: false,
      profile: false,
      parallelism: testParallelismOptions,
      processorFilters: {
        with: [],
        without: ["scan.scope.unversioned-folders"],
        withOnly: [],
      },
    });

    const repositories = JSON.parse(
      readFileSync(path.join(outputDir, "repositories.json"), "utf8"),
    ) as Array<{ name: string; namespace: string }>;
    assert.equal(repositories.length, 2);
    const flowApp = repositories.find((repository) => repository.name === "flow-app");
    assert.equal(flowApp?.namespace, "fuzz/bar/buzz");
  });

  it("writes application modules after scan.extract for maven repository", async () => {
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

    await runScanFlow({
      sourceDirs: [sourceDir],
      outputDir,
      force: false,
      scanId: "test-scan-maven",
      runStartedAt: new Date("2026-08-27T09:00:00.000Z"),
      verbose: false,
      profile: false,
      parallelism: testParallelismOptions,
      processorFilters: {
        with: ["scan.scope.unversioned-folders"],
        without: [],
        withOnly: [],
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

  it("writes REST controllers after parallel scan.extract module-source phase", async () => {
    const root = createTestTempDir("c2a-scan-flow-rest-parallel-");
    const sourceDir = path.join(root, "src");
    const outputDir = path.join(root, "out");
    mkdirSync(sourceDir);
    mkdirSync(outputDir);
    writeFileSync(path.join(sourceDir, "settings.gradle"), `rootProject.name = 'demo'`);
    writeFileSync(
      path.join(sourceDir, "build.gradle"),
      `group = 'com.example'
version = '1.0.0'`,
    );
    const javaDir = path.join(sourceDir, "src", "main", "java", "com", "example", "api");
    mkdirSync(javaDir, { recursive: true });
    for (const fileName of ["UserController.java", "UserContract.java", "UserDto.java"]) {
      cpSync(path.join(SPRING_FIXTURES_DIR, fileName), path.join(javaDir, fileName));
    }

    await runScanFlow({
      sourceDirs: [sourceDir],
      outputDir,
      force: false,
      scanId: "test-scan-rest-parallel",
      runStartedAt: new Date("2026-08-27T09:00:00.000Z"),
      verbose: false,
      profile: false,
      parallelism: testParallelismWorkerPoolOptions,
      processorFilters: {
        with: ["scan.scope.unversioned-folders"],
        without: [],
        withOnly: [],
      },
    });

    const restControllersPath = path.join(outputDir, "rest-controllers.json");
    assert.ok(existsSync(restControllersPath));

    const manifest = JSON.parse(readFileSync(path.join(outputDir, "manifest.json"), "utf8")) as {
      collections: Array<{ path: string; schema: string }>;
    };
    assert.ok(
      manifest.collections.some(
        (collection) =>
          collection.path === "rest-controllers.json" &&
          collection.schema === REST_CONTROLLER_SCHEMA_ID,
      ),
    );

    const controllers = JSON.parse(readFileSync(restControllersPath, "utf8")) as Array<{
      simpleName: string;
      fqcn: string;
    }>;
    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.simpleName, "UserController");
    assert.equal(controllers[0]?.fqcn, "com.example.api.UserController");
  });

  it("records profiling metrics when profiling is enabled", async () => {
    const root = createTestTempDir("c2a-scan-flow-profile-");
    const sourceDir = path.join(root, "src");
    const outputDir = path.join(root, "out");
    mkdirSync(sourceDir);
    mkdirSync(outputDir);

    initProfiling({ enabled: true });
    try {
      await runScanFlow({
        sourceDirs: [sourceDir],
        outputDir,
        force: false,
        scanId: "test-scan-profile",
        runStartedAt: new Date("2026-08-27T09:00:00.000Z"),
        verbose: false,
      profile: false,
      parallelism: testParallelismOptions,
      processorFilters: {
          with: ["scan.scope.unversioned-folders"],
          without: [],
          withOnly: [],
        },
      });

      const reportPath = finalizeProfiling({ command: "scan", verbose: false });
      assert.ok(reportPath);
      assert.ok(existsSync(reportPath!));

      const report = JSON.parse(readFileSync(reportPath!, "utf8")) as {
        metrics: Record<string, number>;
      };
      assert.ok(typeof report.metrics["run.duration.total"] === "number");
      assert.ok(typeof report.metrics['run.step.duration{step="1"}'] === "number");
    } finally {
      resetProfilingState();
    }
  });

  it("writes code-inventory and exits with runtime error when continue-on-error is enabled", async () => {
    processorRegistry.register(new FailingScopeProcessor());
    try {
      const root = createTestTempDir("c2a-scan-flow-coe-");
      const sourceDir = path.join(root, "src");
      const outputDir = path.join(root, "out");
      mkdirSync(sourceDir);
      mkdirSync(outputDir);

      await assert.rejects(
        async () => {
          await runScanFlow({
            sourceDirs: [sourceDir],
            outputDir,
            force: false,
            scanId: "test-scan-coe",
            runStartedAt: new Date("2026-08-27T09:00:00.000Z"),
            verbose: false,
            profile: false,
            parallelism: testParallelismContinueOnError,
            processorFilters: {
              with: [],
              without: [],
              withOnly: [`scan.scope.${FAILING_SCOPE_ARTIFACT}`],
            },
          });
        },
        (error: unknown) => error instanceof CliError && error.exitCode === ExitCode.RUNTIME,
      );

      assert.ok(existsSync(path.join(outputDir, "manifest.json")));
    } finally {
      processorRegistry.unregister("scan.scope", FAILING_SCOPE_ARTIFACT);
    }
  });
});
