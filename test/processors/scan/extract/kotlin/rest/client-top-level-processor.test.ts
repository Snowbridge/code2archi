import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/code-inventory/entities/application-module.js";
import { RunEntityStore } from "../../../../../../src/code-inventory/run-entity-store.js";
import { KotlinRestClientTopLevelProcessor } from "../../../../../../src/processors/scan/extract/kotlin/rest/client-top-level-processor.js";
import { Repository } from "../../../../../../src/code-inventory/entities/repository.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

describe("KotlinRestClientTopLevelProcessor", () => {
  it("creates RestClient from Ktor HttpClient top-level function", () => {
    const root = createTestTempDir("c2a-kotlin-ktor-top-level-");
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
      path.join(kotlinDir, "Gateways.kt"),
      `package com.example

import io.ktor.client.HttpClient

suspend fun fetchPrice(client: HttpClient): String {
    return client.get { url("/api/prices") }.bodyAsText()
}
`,
    );

    const { store } = createStore(root);
    const processor = new KotlinRestClientTopLevelProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "GatewaysKt");
    assert.equal(clients[0]?.symbolKey, "com.example.GatewaysKt");
    assert.equal(clients[0]?.clientLibrary, "ktor-client");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/prices"]);
    assert.equal(clients[0]?.concurrencyModel, "NON_BLOCKING");
    assert.deepEqual(clients[0]?.inheritedContractTypes, []);
  });

  it("aggregates multiple top-level functions into one FileKt client", () => {
    const root = createTestTempDir("c2a-kotlin-ktor-top-level-multi-");
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
      path.join(kotlinDir, "Gateways.kt"),
      `package com.example

import io.ktor.client.HttpClient

suspend fun fetchPrice(client: HttpClient): String {
    return client.get { url("/api/prices") }.bodyAsText()
}

suspend fun fetchStock(client: HttpClient): String {
    return client.get { url("/api/stock") }.bodyAsText()
}
`,
    );

    const { store } = createStore(root);
    const processor = new KotlinRestClientTopLevelProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.symbolKey, "com.example.GatewaysKt");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/prices", "GET /api/stock"]);
  });
});

function createStore(root: string): { store: RunEntityStore } {
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
    scanId: "scan-kotlin-rest-client-top-level",
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

  return { store };
}
