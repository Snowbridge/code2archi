import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/discovery-model/entities/application-module.js";
import { RestClient } from "../../../../../../src/discovery-model/entities/rest-client.js";
import { RunEntityStore } from "../../../../../../src/discovery-model/run-entity-store.js";
import { JavaRestClientDeclarativeProcessor } from "../../../../../../src/processors/scan/source/java/rest/client-declarative-processor.js";
import { Repository } from "../../../../../../src/discovery-model/entities/repository.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

describe("JavaRestClientDeclarativeProcessor", () => {
  it("creates RestClient from @FeignClient interface", () => {
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

    const { module, store } = createStore(root);
    const processor = new JavaRestClientDeclarativeProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.RestClient ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "PaymentFeignClient");
    assert.equal(clients[0]?.discoveryStyle, "DECLARATIVE");
    assert.equal(clients[0]?.clientFramework, "feign");
    assert.equal(clients[0]?.serviceName, "payment-service");
    assert.equal(clients[0]?.baseUrl, "${payment.url}");
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
  });

  it("inherits endpoints from super-interface in same module", () => {
    const root = createTestTempDir("c2a-java-feign-extends-");
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

import org.springframework.web.bind.annotation.GetMapping;

public interface GeneratedApi {
    @GetMapping("/v1/items")
    String listItems();
}
`,
    );
    writeFileSync(
      path.join(javaDir, "ItemFeignClient.java"),
      `package com.example;

import org.springframework.cloud.openfeign.FeignClient;

@FeignClient(name = "items")
public interface ItemFeignClient extends GeneratedApi {
}
`,
    );

    const { store } = createStore(root);
    const processor = new JavaRestClientDeclarativeProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.RestClient ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.fqcn, "com.example.ItemFeignClient");
    assert.deepEqual(clients[0]?.endpoints, ["GET /v1/items"]);
    assert.deepEqual(clients[0]?.extendedInterfaceFqcn, ["com.example.GeneratedApi"]);
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
    const clients = output.entities?.RestClient ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.clientFramework, "http-exchange");
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
    const clients = output.entities?.RestClient ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.clientFramework, "mp-rest-client");
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
    const clients = output.entities?.RestClient ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.clientFramework, "micronaut-client");
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
    const clients = output.entities?.RestClient ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.clientFramework, "retrofit");
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
    "scan.source",
    { groupId: "scan.source.assembly.maven", artifactId: "test" },
    { entities: { ApplicationModule: [module] } },
  );

  return { module, store };
}
