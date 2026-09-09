import assert from "node:assert/strict";
import { cpSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/code-inventory/entities/application-module.js";
import { RunEntityStore } from "../../../../../../src/code-inventory/run-entity-store.js";
import { ProgrammaticRestClientComponentsProcessor } from "../../../../../../src/processors/scan/extract/rest/clients/programmatic-rest-client-components-processor.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../fixtures/jvm/rest/clients/programmatic",
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

function createScanStore(root: string, sourceSubdir: string): RunEntityStore {
  const store = new RunEntityStore({
    sourceDirs: [root],
    scanId: "scan-rest-clients",
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
  copyFixtureTree(path.join(FIXTURES_DIR, sourceSubdir), path.join(root, "src", "main", sourceSubdir));
  return store;
}

describe("ProgrammaticRestClientComponentsProcessor", () => {
  it("discovers PrimeServiceImpl RestTemplate client", () => {
    const root = createTestTempDir("c2a-rest-client-prime-");
    writeFileSync(path.join(root, "settings.gradle"), `rootProject.name = 'demo'`);
    writeFileSync(path.join(root, "build.gradle"), `group = 'com.example'\nversion = '1.0.0'`);
    const store = createScanStore(root, "java");

    const output = new ProgrammaticRestClientComponentsProcessor().process(store.snapshot());
    const clients = output.entities?.RestClient ?? [];
    const prime = clients.find((client) => client.simpleName === "PrimeServiceImpl");

    assert.ok(prime);
    assert.equal(prime.fqcn, "com.farzoom.pear.bg.scoring.services.impl.PrimeServiceImpl");
    assert.deepEqual(prime.endpoints, ["GET /account-report-xml", "GET /company-reg-data"]);
    assert.equal(
      output.entities?.HttpApiContract?.find((item) => item.fqcn === "com.farzoom.pear.bg.scoring.services.PrimeService")?.fqcn,
      "com.farzoom.pear.bg.scoring.services.PrimeService",
    );
    const primeDataTypeFqdns = prime.dataTypeIds
      .map((id) => output.entities?.HttpApiDataType?.find((item) => item.id === id)?.fqcn)
      .filter((fqcn): fqcn is string => fqcn !== undefined)
      .sort();
    assert.deepEqual(primeDataTypeFqdns, [
      "com.farzoom.pear.bg.scoring.model.CompanyAccReportStatus",
      "com.farzoom.pear.bg.scoring.model.CompanyRegData",
    ]);
  });

  it("discovers IntegrationServiceHttpImpl Apache HttpClient", () => {
    const root = createTestTempDir("c2a-rest-client-integration-");
    writeFileSync(path.join(root, "settings.gradle"), `rootProject.name = 'demo'`);
    writeFileSync(path.join(root, "build.gradle"), `group = 'com.example'\nversion = '1.0.0'`);
    const store = createScanStore(root, "java");

    const output = new ProgrammaticRestClientComponentsProcessor().process(store.snapshot());
    const clients = output.entities?.RestClient ?? [];
    const integration = clients.find((client) => client.simpleName === "IntegrationServiceHttpImpl");

    assert.ok(integration);
    assert.equal(integration.fqcn, "com.farzoom.api.bg.zgr.service.IntegrationServiceHttpImpl");
    assert.deepEqual(integration.endpoints, ["POST /upload", "POST /uploadResult"]);
    assert.equal(
      output.entities?.HttpApiContract?.find((item) => item.fqcn === "com.farzoom.api.bg.zgr.IntegrationService")?.fqcn,
      "com.farzoom.api.bg.zgr.IntegrationService",
    );
  });

  it("discovers BundleRestClient Kotlin RestTemplate client with 12 endpoints", () => {
    const root = createTestTempDir("c2a-rest-client-bundle-");
    writeFileSync(path.join(root, "settings.gradle"), `rootProject.name = 'demo'`);
    writeFileSync(path.join(root, "build.gradle"), `group = 'com.example'\nversion = '1.0.0'`);
    const store = createScanStore(root, "kotlin");

    const output = new ProgrammaticRestClientComponentsProcessor().process(store.snapshot());
    const clients = output.entities?.RestClient ?? [];
    const bundle = clients.find((client) => client.simpleName === "BundleRestClient");

    assert.ok(bundle);
    assert.equal(bundle.fqcn, "com.example.client.BundleRestClient");
    assert.equal(bundle.endpoints.length, 12);
    assert.ok(bundle.endpoints.includes("POST /v1/bundle"));
    assert.ok(bundle.endpoints.includes("GET /v1/bundles"));
    assert.equal(
      output.entities?.HttpApiContract?.find((item) => item.fqcn === "com.example.client.V1BundleControllerApi")?.fqcn,
      "com.example.client.V1BundleControllerApi",
    );
    assert.ok((output.entities?.HttpApiDataType ?? []).length >= 9);
    assert.ok(
      output.entities?.HttpApiDataType?.some((item) => item.fqcn === "com.example.client.BundleRecord"),
    );
  });
});
