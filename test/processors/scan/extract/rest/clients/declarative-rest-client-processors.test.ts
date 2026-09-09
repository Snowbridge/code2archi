import assert from "node:assert/strict";
import { cpSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/code-inventory/entities/application-module.js";
import { RunEntityStore } from "../../../../../../src/code-inventory/run-entity-store.js";
import { JaxRsProcessor } from "../../../../../../src/processors/scan/extract/rest/controllers/jax-rs-processor.js";
import { MicronautClientProcessor } from "../../../../../../src/processors/scan/extract/rest/clients/micronaut-client-processor.js";
import { MicroProfileRestClientProcessor } from "../../../../../../src/processors/scan/extract/rest/clients/microprofile-rest-client-processor.js";
import { RetrofitProcessor } from "../../../../../../src/processors/scan/extract/rest/clients/retrofit-processor.js";
import { SpringHttpExchangeProcessor } from "../../../../../../src/processors/scan/extract/rest/clients/spring-http-exchange-processor.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../fixtures/jvm/rest/clients/declarative",
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

function createScanStore(root: string): RunEntityStore {
  const store = new RunEntityStore({
    sourceDirs: [root],
    scanId: "scan-declarative-rest-clients",
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
  copyFixtureTree(path.join(FIXTURES_DIR, "java"), path.join(root, "src", "main", "java"));
  return store;
}

function bootstrapProject(root: string): void {
  writeFileSync(path.join(root, "settings.gradle"), `rootProject.name = 'demo'`);
  writeFileSync(path.join(root, "build.gradle"), `group = 'com.example'\nversion = '1.0.0'`);
}

describe("SpringHttpExchangeProcessor", () => {
  it("discovers @HttpExchange client with endpoints and DTO", () => {
    const root = createTestTempDir("c2a-she-client-");
    bootstrapProject(root);
    const store = createScanStore(root);

    const output = new SpringHttpExchangeProcessor().process(store.snapshot());
    const client = output.entities?.RestClient?.find(
      (item) => item.simpleName === "CamundaMetricsClient",
    );

    assert.ok(client);
    assert.equal(client.fqcn, "com.example.client.CamundaMetricsClient");
    assert.deepEqual(client.endpoints, ["GET /actuator/camunda/metrics"]);
    assert.deepEqual(client.contractIds, []);
    assert.ok(
      output.entities?.HttpApiDataType?.some((item) => item.fqcn === "com.example.client.MetricsDto"),
    );
  });

  it("discovers ItemClient with contract from extends", () => {
    const root = createTestTempDir("c2a-she-extends-");
    bootstrapProject(root);
    const store = createScanStore(root);

    const output = new SpringHttpExchangeProcessor().process(store.snapshot());
    const client = output.entities?.RestClient?.find((item) => item.simpleName === "ItemClient");

    assert.ok(client);
    assert.equal(
      output.entities?.HttpApiContract?.find((item) => item.fqcn === "com.example.client.ItemApi")?.fqcn,
      "com.example.client.ItemApi",
    );
    assert.ok(client.contractIds.length > 0);
    assert.deepEqual(client.endpoints, []);
  });
});

describe("RetrofitProcessor", () => {
  it("discovers Retrofit interface with retrofit2.http.GET", () => {
    const root = createTestTempDir("c2a-retrofit-client-");
    bootstrapProject(root);
    const store = createScanStore(root);

    const output = new RetrofitProcessor().process(store.snapshot());
    const client = output.entities?.RestClient?.find((item) => item.simpleName === "PaymentApi");

    assert.ok(client);
    assert.deepEqual(client.endpoints, ["GET /payments/{id}"]);
    assert.ok(
      output.entities?.HttpApiDataType?.some((item) => item.fqcn === "com.example.client.PaymentDto"),
    );
  });

  it("skips @FeignClient types", () => {
    const root = createTestTempDir("c2a-retrofit-feign-");
    bootstrapProject(root);
    const store = createScanStore(root);

    const output = new RetrofitProcessor().process(store.snapshot());
    assert.equal(
      output.entities?.RestClient?.find((item) => item.simpleName === "PaymentFeignClient"),
      undefined,
    );
  });
});

describe("MicroProfileRestClientProcessor", () => {
  it("discovers @RegisterRestClient with JAX-RS endpoints", () => {
    const root = createTestTempDir("c2a-mp-client-");
    bootstrapProject(root);
    const store = createScanStore(root);

    const output = new MicroProfileRestClientProcessor().process(store.snapshot());
    const client = output.entities?.RestClient?.find((item) => item.simpleName === "OrderClient");

    assert.ok(client);
    assert.deepEqual(client.endpoints, ["GET /orders/{id}"]);
    assert.ok(
      output.entities?.HttpApiDataType?.some((item) => item.fqcn === "com.example.client.OrderDto"),
    );
  });
});

describe("MicronautClientProcessor", () => {
  it("discovers @Client declarative HTTP client", () => {
    const root = createTestTempDir("c2a-mn-client-");
    bootstrapProject(root);
    const store = createScanStore(root);

    const output = new MicronautClientProcessor().process(store.snapshot());
    const client = output.entities?.RestClient?.find(
      (item) => item.simpleName === "MicronautOrderClient",
    );

    assert.ok(client);
    assert.deepEqual(client.endpoints, ["GET /api/orders/{id}"]);
  });
});

describe("JaxRsProcessor exclusion", () => {
  it("does not treat @RegisterRestClient interface as RestController", () => {
    const root = createTestTempDir("c2a-jaxrs-mp-exclusion-");
    bootstrapProject(root);
    const store = createScanStore(root);

    const output = new JaxRsProcessor().process(store.snapshot());
    assert.equal(
      output.entities?.RestController?.find((item) => item.simpleName === "OrderClient"),
      undefined,
    );
  });
});
