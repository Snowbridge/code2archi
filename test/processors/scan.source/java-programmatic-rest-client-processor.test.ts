import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../src/discovery-model/entities/application-module.js";
import { RunEntityStore } from "../../../src/discovery-model/run-entity-store.js";
import { JavaProgrammaticRestClientProcessor } from "../../../src/processors/scan.source/java-programmatic-rest-client-processor.js";
import { Repository } from "../../../src/discovery-model/entities/repository.js";
import { createTestTempDir } from "../../test-temp-dir.js";

describe("JavaProgrammaticRestClientProcessor", () => {
  it("creates RestClient from RestTemplate usage in concrete class", () => {
    const root = createTestTempDir("c2a-java-rest-template-");
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
      path.join(javaDir, "OrderRestClient.java"),
      `package com.example;

import org.springframework.web.client.RestTemplate;

public class OrderRestClient {
    private final RestTemplate restTemplate = new RestTemplate();

    public String fetch(String id) {
        return restTemplate.getForObject("/api/orders/" + id, String.class);
    }
}
`,
    );

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
      scanId: "scan-rest-client-programmatic",
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

    const processor = new JavaProgrammaticRestClientProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.RestClient ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "OrderRestClient");
    assert.equal(clients[0]?.discoveryStyle, "PROGRAMMATIC");
    assert.equal(clients[0]?.clientFramework, "rest-template");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/orders"]);
    assert.deepEqual(clients[0]?.extendedInterfaceFqcn, []);
  });

  it("skips abstract RestClient base classes", () => {
    const root = createTestTempDir("c2a-java-abstract-rest-client-");
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
      path.join(javaDir, "AbstractScoringServiceRestClient.java"),
      `package com.example;

import org.springframework.web.client.RestTemplate;

public abstract class AbstractScoringServiceRestClient {
    protected RestTemplate restTemplate;

    protected String getData(String path) {
        return restTemplate.getForObject("/api/scoring" + path, String.class);
    }
}
`,
    );

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
      scanId: "scan-rest-client-abstract",
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

    const processor = new JavaProgrammaticRestClientProcessor();
    const output = processor.process(store.snapshot());
    assert.equal(output.entities?.RestClient?.length ?? 0, 0);
  });
});
