import assert from "node:assert/strict";
import { cpSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/code-inventory/entities/application-module.js";
import type { CreateIntents } from "../../../../../../src/code-inventory/entities/create-intents.js";
import { Repository } from "../../../../../../src/code-inventory/entities/repository.js";
import type { RestClientRecord } from "../../../../../../src/code-inventory/entities/rest-client.js";
import { RunEntityStore } from "../../../../../../src/code-inventory/run-entity-store.js";
import { withProcessorSupplements } from "../../../../../../src/platform/processors/processor-supplements.js";
import { SupplementedRestClientComponentsProcessor } from "../../../../../../src/processors/scan/extract/rest/clients/supplemented-rest-client-components-processor.js";
import type { ScanAppInput } from "../../../../../../src/platform/processors/processor.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../fixtures/jvm/rest/clients/supplemented",
);

const SUPPLEMENT_BASENAMES = ["rest-client.json", "rest-clients.json"] as const;
const SUPPLEMENT_BASENAME = SUPPLEMENT_BASENAMES[0];

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

function createScanStore(root: string): RunEntityStore {
  const store = new RunEntityStore({
    sourceDirs: [root],
    scanId: "scan-supplemented-rest-clients",
    runStartedAt: new Date("2026-09-09T12:00:00.000Z"),
  });
  const repository = new Repository({
    name: "consumer",
    namespace: "",
    localPath: root,
    url: "",
    buildSystems: ["gradle"],
  });
  const module = new ApplicationModule({
    repositoryId: repository.id,
    buildSystem: "gradle",
    groupId: "com.example",
    artifactId: "consumer",
    version: "1.0.0",
    name: "consumer",
    repoPath: "",
    buildScript: "build.gradle",
    isMultimodule: false,
  });
  store.addCreateIntents(
    "scan.scope",
    { groupId: "scan.scope", artifactId: "test" },
    {
      entities: {
        Repository: [repository.toCreateIntent()],
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
  copyFixtureTree(path.join(FIXTURES_DIR, "java"), path.join(root, "src", "main", "java"));
  return store;
}

function runProcessor(
  store: RunEntityStore,
  supplementPath: string | undefined,
  basename: string = SUPPLEMENT_BASENAME,
): CreateIntents {
  return new SupplementedRestClientComponentsProcessor().process(
    withSupplement(store, supplementPath, basename),
  ) as CreateIntents;
}

function findClient(output: CreateIntents, fqcn: string): RestClientRecord | undefined {
  return (output.entities?.RestClient as readonly RestClientRecord[] | undefined)?.find(
    (item) => item.fqcn === fqcn,
  );
}

function bootstrapProject(root: string): void {
  writeFileSync(path.join(root, "settings.gradle"), `rootProject.name = 'consumer'`);
  writeFileSync(path.join(root, "build.gradle"), `group = 'com.example'\nversion = '1.0.0'`);
}

function writeSupplement(root: string, entries: unknown, basename: string = SUPPLEMENT_BASENAME): string {
  const supplementPath = path.join(root, basename);
  writeFileSync(supplementPath, JSON.stringify(entries), "utf8");
  return supplementPath;
}

function withSupplement(
  store: RunEntityStore,
  supplementPath: string | undefined,
  basename: string = SUPPLEMENT_BASENAME,
): ScanAppInput {
  return withProcessorSupplements(
    store.snapshot(),
    supplementPath === undefined ? [] : [{ path: supplementPath, basename }],
  );
}

function consumerModuleId(store: RunEntityStore): string {
  const module = store.snapshot().listEntities("ApplicationModule")[0];
  assert.ok(module);
  return module.id;
}

describe("SupplementedRestClientComponentsProcessor", () => {
  it("adds RestClient to a consuming module for a client used as a field", () => {
    const root = createTestTempDir("c2a-suppl-field-");
    bootstrapProject(root);
    const store = createScanStore(root);
    const moduleId = consumerModuleId(store);
    const supplementPath = writeSupplement(root, [
      {
        fqcn: "com.example.client.PaymentFeignClient",
        applicationModuleId: "origin-module-123",
        simpleName: "PaymentFeignClient",
        fileName: "client/src/main/java/com/example/client/PaymentFeignClient.java",
        endpoints: [],
        contractIds: [],
        dataTypeIds: [],
      },
    ]);

    const output = runProcessor(store, supplementPath);
    const client = findClient(output, "com.example.client.PaymentFeignClient");

    assert.ok(client);
    assert.equal(client.simpleName, "PaymentFeignClient");
    assert.equal(client.applicationModuleId, moduleId);
    assert.equal(
      client.fileName,
      "client/src/main/java/com/example/client/PaymentFeignClient.java",
    );
    assert.deepEqual(client.endpoints, []);
  });

  it("discovers clients from a rest-clients.json supplement (code-inventory artifact name)", () => {
    const root = createTestTempDir("c2a-suppl-plural-");
    bootstrapProject(root);
    const store = createScanStore(root);
    const moduleId = consumerModuleId(store);
    const basename = "rest-clients.json";
    const supplementPath = writeSupplement(
      root,
      [
        {
          fqcn: "com.example.client.PaymentFeignClient",
          applicationModuleId: "origin-module-123",
          simpleName: "PaymentFeignClient",
          fileName: "client/src/main/java/com/example/client/PaymentFeignClient.java",
        },
      ],
      basename,
    );

    const output = runProcessor(store, supplementPath, basename);
    const client = findClient(output, "com.example.client.PaymentFeignClient");

    assert.ok(client);
    assert.equal(client.simpleName, "PaymentFeignClient");
    assert.equal(client.applicationModuleId, moduleId);
    assert.deepEqual(client.endpoints, []);
  });

  it("skips when the found module is the client's own origin module", () => {
    const root = createTestTempDir("c2a-suppl-skip-");
    bootstrapProject(root);
    const store = createScanStore(root);
    const moduleId = consumerModuleId(store);
    const supplementPath = writeSupplement(root, [
      {
        fqcn: "com.example.client.PaymentFeignClient",
        applicationModuleId: moduleId,
        simpleName: "PaymentFeignClient",
      },
    ]);

    const output = runProcessor(store, supplementPath);

    assert.equal(findClient(output, "com.example.client.PaymentFeignClient"), undefined);
  });

  it("does nothing when no rest-client.json supplement is provided", () => {
    const root = createTestTempDir("c2a-suppl-none-");
    bootstrapProject(root);
    const store = createScanStore(root);

    const output = runProcessor(store, undefined);

    assert.equal(output.entities?.RestClient, undefined);
  });

  it("does nothing when the supplement has invalid format", () => {
    const root = createTestTempDir("c2a-suppl-invalid-");
    bootstrapProject(root);
    const store = createScanStore(root);
    const supplementPath = path.join(root, SUPPLEMENT_BASENAME);
    writeFileSync(supplementPath, "not-a-json-array", "utf8");

    const output = runProcessor(store, supplementPath);

    assert.equal(output.entities?.RestClient, undefined);
  });

  it("ignores a supplement missing fqcn as invalid", () => {
    const root = createTestTempDir("c2a-suppl-missing-fqcn-");
    bootstrapProject(root);
    const store = createScanStore(root);
    const supplementPath = writeSupplement(root, [
      { applicationModuleId: "origin-module-123" },
    ]);

    const output = runProcessor(store, supplementPath);

    assert.equal(output.entities?.RestClient, undefined);
  });
});