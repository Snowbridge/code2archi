import assert from "node:assert/strict";
import { cpSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/code-inventory/entities/application-module.js";
import { RunEntityStore } from "../../../../../../src/code-inventory/run-entity-store.js";
import { FeignProgrammaticBeansProcessor } from "../../../../../../src/processors/scan/extract/rest/clients/feign-programmatic-beans-processor.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

const FIXTURES_ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../fixtures/jvm/rest/clients/feign-programmatic-beans",
);

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

function bootstrapProject(root: string): void {
  writeFileSync(path.join(root, "settings.gradle"), `rootProject.name = 'demo'`);
  writeFileSync(path.join(root, "build.gradle"), `group = 'com.example'\nversion = '1.0.0'`);
}

function createScanStore(root: string, fixtureSubdir: string): RunEntityStore {
  const store = new RunEntityStore({
    sourceDirs: [root],
    scanId: "scan-feign-programmatic-beans",
    runStartedAt: new Date("2026-09-09T12:00:00.000Z"),
  });
  const module = new ApplicationModule({
    repositoryId: "repo-1",
    buildSystem: "gradle",
    groupId: "com.example",
    artifactId: "demo",
    version: "1.0.0",
    name: "demo",
    repoPath: "",
    buildScript: "build.gradle",
    isMultimodule: false,
  });
  store.addCreateIntents(
    "scan.scope",
    { groupId: "scan.scope", artifactId: "test" },
    {
      entities: {
        Repository: [
          {
            id: "repo-1",
            name: "demo",
            namespace: "",
            localPath: root,
            url: "",
            buildSystems: ["gradle"],
          },
        ],
      },
    },
  );
  store.addCreateIntents(
    "scan.extract",
    { groupId: "scan.extract", artifactId: "test" },
    {
      entities: {
        ApplicationModule: [module.toCreateIntent()],
      },
    },
  );

  const fixturePath = path.join(FIXTURES_ROOT, fixtureSubdir);
  const javaSrc = path.join(fixturePath, "java");
  const kotlinSrc = path.join(fixturePath, "kotlin");
  if (statSync(javaSrc, { throwIfNoEntry: false })?.isDirectory()) {
    copyFixtureTree(javaSrc, path.join(root, "src", "main", "java"));
  }
  if (statSync(kotlinSrc, { throwIfNoEntry: false })?.isDirectory()) {
    copyFixtureTree(kotlinSrc, path.join(root, "src", "main", "kotlin"));
  }
  return store;
}

describe("FeignProgrammaticBeansProcessor", () => {
  it("path A: discovers FeignClientBuilder @Bean with contract assignment", () => {
    const root = createTestTempDir("c2a-feign-prog-a-");
    bootstrapProject(root);
    const store = createScanStore(root, "path-a-spring-builder");

    const output = new FeignProgrammaticBeansProcessor().process(store.snapshot());
    const client = output.entities?.RestClient?.find(
      (item) => item.fqcn === "com.example.client.WrappedDaemonClient",
    );

    assert.ok(client);
    assert.deepEqual(client.endpoints, []);
    assert.deepEqual(client.dataTypeIds, []);
    assert.ok(client.fileName.includes("FeignClientsConfiguration.java"));
    assert.equal(
      output.entities?.HttpApiContract?.find((item) => item.fqcn === "com.example.client.DaemonApi")
        ?.fqcn,
      "com.example.client.DaemonApi",
    );
    const assignments =
      output.links?.HttpApiContractAssignment?.filter((link) => link.assigneeId === client.id) ?? [];
    assert.equal(assignments.length, 1);
    assert.equal(output.entities?.HttpApiDataType?.length ?? 0, 0);
  });

  it("path A: discovers client via local variable return", () => {
    const root = createTestTempDir("c2a-feign-prog-local-");
    bootstrapProject(root);
    const store = createScanStore(root, "path-a-local-var");

    const output = new FeignProgrammaticBeansProcessor().process(store.snapshot());
    const client = output.entities?.RestClient?.find(
      (item) => item.fqcn === "com.example.client.WrappedDaemonClient",
    );

    assert.ok(client);
    const assignments =
      output.links?.HttpApiContractAssignment?.filter((link) => link.assigneeId === client.id) ?? [];
    assert.equal(assignments.length, 1);
  });

  it("path B: discovers Feign.builder().target() Kotlin @Bean", () => {
    const root = createTestTempDir("c2a-feign-prog-b-");
    bootstrapProject(root);
    const store = createScanStore(root, "path-b-raw-feign");

    const output = new FeignProgrammaticBeansProcessor().process(store.snapshot());
    const client = output.entities?.RestClient?.find(
      (item) => item.fqcn === "com.example.client.LegacyGateway",
    );

    assert.ok(client);
    assert.deepEqual(client.endpoints, []);
    assert.equal(
      output.entities?.HttpApiContract?.find((item) => item.fqcn === "com.example.client.LegacyApi")
        ?.fqcn,
      "com.example.client.LegacyApi",
    );
    const assignments =
      output.links?.HttpApiContractAssignment?.filter((link) => link.assigneeId === client.id) ?? [];
    assert.equal(assignments.length, 1);
  });
});
