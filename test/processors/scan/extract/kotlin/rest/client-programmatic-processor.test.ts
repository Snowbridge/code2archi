import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/code-inventory/entities/application-module.js";
import { RunEntityStore } from "../../../../../../src/code-inventory/run-entity-store.js";
import { KotlinRestClientProgrammaticProcessor } from "../../../../../../src/processors/scan/extract/kotlin/rest/client-programmatic-processor.js";
import { Repository } from "../../../../../../src/code-inventory/entities/repository.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

describe("KotlinRestClientProgrammaticProcessor", () => {
  it("creates RestClient from WebClient wrapper class", () => {
    const root = createTestTempDir("c2a-kotlin-webclient-");
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
      path.join(kotlinDir, "BasepriceDataApiWebclient.kt"),
      `package com.example

import org.springframework.web.reactive.function.client.WebClient

class BasepriceDataApiWebclient(private val webClient: WebClient) {
    fun fetchPrice(id: String): String {
        return webClient.get().uri("/api/baseprice/\$id").retrieve().bodyToMono(String::class.java).block()!!
    }
}
`,
    );

    const { module, store } = createStore(root);
    const processor = new KotlinRestClientProgrammaticProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "BasepriceDataApiWebclient");
    assert.equal(clients[0]?.symbolKey, "com.example.BasepriceDataApiWebclient");
    assert.equal(clients[0]?.bindingStyle, "INLINE_HTTP");
    assert.equal(clients[0]?.clientLibrary, "webclient");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/baseprice/$id"]);
    assert.equal(clients[0]?.applicationModuleId, module.id);
  });

  it("creates RestClient from OkHttpClient wrapper class", () => {
    const root = createTestTempDir("c2a-kotlin-okhttp-");
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
      path.join(kotlinDir, "OkOrderClient.kt"),
      `package com.example

import okhttp3.OkHttpClient
import okhttp3.Request

class OkOrderClient(private val client: OkHttpClient) {
    fun fetch() {
        client.newCall(Request.Builder().url("/api/orders").build()).execute()
    }
}
`,
    );

    const { store } = createStore(root);
    const processor = new KotlinRestClientProgrammaticProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "OkOrderClient");
    assert.equal(clients[0]?.clientLibrary, "okhttp");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/orders"]);
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
    scanId: "scan-kotlin-rest-client-programmatic",
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
