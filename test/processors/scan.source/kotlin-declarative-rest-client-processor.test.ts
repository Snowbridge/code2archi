import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../src/discovery-model/entities/application-module.js";
import { RestClient } from "../../../src/discovery-model/entities/rest-client.js";
import { RunEntityStore } from "../../../src/discovery-model/run-entity-store.js";
import { KotlinDeclarativeRestClientProcessor } from "../../../src/processors/scan.source/kotlin-declarative-rest-client-processor.js";
import { Repository } from "../../../src/discovery-model/entities/repository.js";
import { createTestTempDir } from "../../test-temp-dir.js";

describe("KotlinDeclarativeRestClientProcessor", () => {
  it("creates RestClient from @FeignClient interface", () => {
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

    const { module, store } = createStore(root);
    const processor = new KotlinDeclarativeRestClientProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.RestClient ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "PaymentFeignClient");
    assert.equal(clients[0]?.discoveryStyle, "DECLARATIVE");
    assert.equal(clients[0]?.clientFramework, "feign");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/payments/:id"]);
    assert.equal(clients[0]?.applicationModuleId, module.id);

    const entity = new RestClient({
      applicationModuleId: module.id,
      name: clients[0]!.name,
      fqcn: clients[0]!.fqcn,
      dtoFqcn: clients[0]!.dtoFqcn,
      endpoints: clients[0]!.endpoints,
      tcpStackType: clients[0]!.tcpStackType,
      discoveryStyle: "DECLARATIVE",
      clientFramework: "feign",
      extendedInterfaceFqcn: [],
      sourceFile: clients[0]!.sourceFile,
      serviceName: clients[0]!.serviceName,
      baseUrl: clients[0]!.baseUrl,
    });
    assert.equal(entity.id, clients[0]?.id);
    assert.equal(clients[0]?.fqcn, "com.example.PaymentFeignClient");
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
    "scan.source",
    { groupId: "scan.source.assembly.maven", artifactId: "test" },
    { entities: { ApplicationModule: [module] } },
  );

  return { module, store };
}
