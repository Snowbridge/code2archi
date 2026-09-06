import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/discovery-model/entities/application-module.js";
import { toTypeReferenceFromQualifiedName } from "../../../../../../src/discovery-model/entities/type-reference.js";
import { RunEntityStore } from "../../../../../../src/discovery-model/run-entity-store.js";
import { JavaRestClientDeclarativeProcessor } from "../../../../../../src/processors/scan/extract/java/rest/client-declarative-processor.js";
import { Repository } from "../../../../../../src/discovery-model/entities/repository.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

describe("JavaRestClientDeclarativeProcessor", () => {
  it("does not create RestClient from @FeignClient interface", () => {
    const root = createTestTempDir("c2a-java-feign-client-");
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
      path.join(javaDir, "PaymentFeignClient.java"),
      `package com.example;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

@FeignClient(name = "payment-service", url = "\${payment.url}")
public interface PaymentFeignClient {
    @GetMapping("/api/payments/{id}")
    String getPayment(String id);
}
`,
    );

    const { store } = createStore(root);
    const processor = new JavaRestClientDeclarativeProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 0);
  });

  it("inherits endpoints from super-interface in same module", () => {
    const root = createTestTempDir("c2a-java-http-exchange-extends-");
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
      path.join(javaDir, "GeneratedApi.java"),
      `package com.example;

import org.springframework.web.service.annotation.GetExchange;

public interface GeneratedApi {
    @GetExchange("/v1/items")
    String listItems();
}
`,
    );
    writeFileSync(
      path.join(javaDir, "ItemClient.java"),
      `package com.example;

import org.springframework.web.service.annotation.HttpExchange;

@HttpExchange
public interface ItemClient extends GeneratedApi {
}
`,
    );

    const { store } = createStore(root);
    const processor = new JavaRestClientDeclarativeProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.symbolKey, "com.example.ItemClient");
    assert.deepEqual(clients[0]?.endpoints, ["GET /v1/items"]);
    assert.deepEqual(clients[0]?.inheritedContractTypes, [
      toTypeReferenceFromQualifiedName("com.example.GeneratedApi"),
    ]);
  });

  it("creates RestClient from @HttpExchange interface", () => {
    const root = createTestTempDir("c2a-java-http-exchange-");
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
      path.join(javaDir, "MetricsClient.java"),
      `package com.example;

import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;

@HttpExchange
public interface MetricsClient {
    @GetExchange("/actuator/metrics")
    String metrics();
}
`,
    );

    const { store } = createStore(root);
    const processor = new JavaRestClientDeclarativeProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.clientLibrary, "http-exchange");
    assert.deepEqual(clients[0]?.endpoints, ["GET /actuator/metrics"]);
  });

  it("creates RestClient from @RegisterRestClient MP REST interface", () => {
    const root = createTestTempDir("c2a-java-mp-rest-client-");
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
      path.join(javaDir, "OrderClient.java"),
      `package com.example;

import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;

@RegisterRestClient(configKey = "orders")
@Path("/api/orders")
public interface OrderClient {
    @GET
    @Path("/{id}")
    String get(String id);
}
`,
    );

    const { store } = createStore(root);
    const processor = new JavaRestClientDeclarativeProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.clientLibrary, "mp-rest-client");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/orders/:id"]);
  });

  it("creates RestClient from Micronaut @Client interface", () => {
    const root = createTestTempDir("c2a-java-micronaut-client-");
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
      path.join(javaDir, "OrderClient.java"),
      `package com.example;

import io.micronaut.http.annotation.Get;
import io.micronaut.http.client.annotation.Client;

@Client("/api/orders")
public interface OrderClient {
    @Get("/{id}")
    String get(String id);
}
`,
    );

    const { store } = createStore(root);
    const processor = new JavaRestClientDeclarativeProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.clientLibrary, "micronaut-client");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/orders/:id"]);
  });

  it("creates RestClient from Retrofit interface", () => {
    const root = createTestTempDir("c2a-java-retrofit-client-");
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
      path.join(javaDir, "OrderApi.java"),
      `package com.example;

import retrofit2.http.GET;
import retrofit2.http.Path;

public interface OrderApi {
    @GET("/api/orders/{id}")
    String get(@Path("id") String id);
}
`,
    );

    const { store } = createStore(root);
    const processor = new JavaRestClientDeclarativeProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.clientLibrary, "retrofit");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/orders/:id"]);
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
    scanId: "scan-rest-client",
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
