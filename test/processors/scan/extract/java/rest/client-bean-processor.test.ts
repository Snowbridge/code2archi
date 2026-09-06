import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/discovery-model/entities/application-module.js";
import { RunEntityStore } from "../../../../../../src/discovery-model/run-entity-store.js";
import { JavaRestClientBeanProcessor } from "../../../../../../src/processors/scan/extract/java/rest/client-bean-processor.js";
import { Repository } from "../../../../../../src/discovery-model/entities/repository.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

describe("JavaRestClientBeanProcessor", () => {
  it("creates RestClient from @Bean WebClient factory method", () => {
    const root = createTestTempDir("c2a-java-bean-webclient-");
    const javaDir = path.join(root, "src", "main", "java", "com", "example");
    mkdirSync(javaDir, { recursive: true });
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
      path.join(javaDir, "ExternalApiConfig.java"),
      `package com.example;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class ExternalApiConfig {
    @Bean
    public WebClient pricingWebClient() {
        return WebClient.create().get().uri("/api/prices").retrieve().bodyToMono(String.class).block();
    }
}
`,
    );

    const { store } = createStore(root);
    const processor = new JavaRestClientBeanProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "ExternalApiConfig");
    assert.equal(clients[0]?.symbolKey, "com.example.ExternalApiConfig");
    assert.equal(clients[0]?.clientLibrary, "webclient");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/prices"]);
    assert.deepEqual(clients[0]?.inheritedContractTypes, []);
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
    scanId: "scan-java-rest-client-bean",
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
