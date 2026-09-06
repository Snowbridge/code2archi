import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/code-inventory/entities/application-module.js";
import { RunEntityStore } from "../../../../../../src/code-inventory/run-entity-store.js";
import { KotlinRestClientDeclarativeProcessor } from "../../../../../../src/processors/scan/extract/kotlin/rest/client-declarative-processor.js";
import { Repository } from "../../../../../../src/code-inventory/entities/repository.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

describe("KotlinRestClientDeclarativeProcessor", () => {
  it("does not create RestClient from @FeignClient interface", () => {
    const root = createTestTempDir("c2a-kotlin-feign-client-");
    const kotlinDir = path.join(root, "src", "main", "kotlin", "com", "example");
    mkdirSync(kotlinDir, { recursive: true });
    writeFileSync(
      path.join(root, "pom.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>app</artifactId>
  <version>1.0.0</version>
</project>`,
    );
    writeFileSync(
      path.join(kotlinDir, "PaymentFeignClient.kt"),
      `package com.example

import org.springframework.cloud.openfeign.FeignClient
import org.springframework.web.bind.annotation.GetMapping

@FeignClient(name = "payment-service", url = "\${payment.url}")
interface PaymentFeignClient {
    @GetMapping("/api/payments/{id}")
    fun getPayment(id: String): String
}
`,
    );

    const { store } = createStore(root);
    const processor = new KotlinRestClientDeclarativeProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 0);
  });
});

function createStore(root: string): { module: ApplicationModule; store: RunEntityStore } {
  const repository = new Repository({
    url: "",
    localPath: root,
    name: "app",
    namespace: "",
    buildSystems: ["maven"],
  });
  const module = new ApplicationModule({
    repositoryId: repository.id,
    buildSystem: "maven",
    groupId: "com.example",
    artifactId: "app",
    version: "1.0.0",
    name: "app",
    repoPath: ".",
    buildScript: "pom.xml",
    isMultimodule: false,
    javaVersion: "17",
  });

  const store = new RunEntityStore({
    sourceDirs: [root],
    scanId: "scan-kotlin-rest-client",
    runStartedAt: new Date("2026-09-01T12:00:00.000Z"),
  });
  store.addCreateIntents(
    "scan.scope",
    { groupId: "scan.scope", artifactId: "test" },
    { entities: { Repository: [repository] } },
  );
  store.addCreateIntents(
    "scan.extract",
    { groupId: "scan.extract.assembly.maven", artifactId: "test" },
    { entities: { ApplicationModule: [module] } },
  );

  return { module, store };
}
