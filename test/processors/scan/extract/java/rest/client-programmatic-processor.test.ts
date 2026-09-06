import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/code-inventory/entities/application-module.js";
import { RunEntityStore } from "../../../../../../src/code-inventory/run-entity-store.js";
import { JavaRestClientProgrammaticProcessor } from "../../../../../../src/processors/scan/extract/java/rest/client-programmatic-processor.js";
import { Repository } from "../../../../../../src/code-inventory/entities/repository.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

describe("JavaRestClientProgrammaticProcessor", () => {
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
      "scan.extract",
      { groupId: "scan.extract.assembly.maven", artifactId: "test" },
      { entities: { ApplicationModule: [module] } },
    );

    const processor = new JavaRestClientProgrammaticProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "OrderRestClient");
    assert.equal(clients[0]?.bindingStyle, "INLINE_HTTP");
    assert.equal(clients[0]?.clientLibrary, "rest-template");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/orders"]);
    assert.deepEqual(clients[0]?.inheritedContractTypes, []);
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
      "scan.extract",
      { groupId: "scan.extract.assembly.maven", artifactId: "test" },
      { entities: { ApplicationModule: [module] } },
    );

    const processor = new JavaRestClientProgrammaticProcessor();
    const output = processor.process(store.snapshot());
    assert.equal(output.entities?.HttpClientApi?.length ?? 0, 0);
  });

  it("creates RestClient from Apache HttpClient 4.x CloseableHttpClient", () => {
    const root = createTestTempDir("c2a-java-apache-http-4-");
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

import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;

public class OrderClient {
    private final CloseableHttpClient httpClient = HttpClients.createDefault();

    public String fetch() throws Exception {
        return httpClient.execute(new HttpGet("/api/orders")).toString();
    }

    public void create() throws Exception {
        httpClient.execute(new HttpPost("/api/orders"));
    }
}
`,
    );

    const { store } = createMavenStore(root, "scan-apache-http-4");
    const processor = new JavaRestClientProgrammaticProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "OrderClient");
    assert.equal(clients[0]?.clientLibrary, "apache-http");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/orders", "POST /api/orders"]);
  });

  it("creates RestClient from Apache HttpClient 5.x ClassicRequestBuilder", () => {
    const root = createTestTempDir("c2a-java-apache-http-5-");
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

import org.apache.hc.client5.http.classic.methods.ClassicRequestBuilder;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;

public class MetricsClient {
    private final CloseableHttpClient httpClient = HttpClients.createDefault();

    public void metrics() throws Exception {
        httpClient.execute(ClassicRequestBuilder.get("/actuator/metrics").build());
    }
}
`,
    );

    const { store } = createMavenStore(root, "scan-apache-http-5");
    const processor = new JavaRestClientProgrammaticProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "MetricsClient");
    assert.equal(clients[0]?.clientLibrary, "apache-http");
    assert.deepEqual(clients[0]?.endpoints, ["GET /actuator/metrics"]);
  });

  it("creates RestClient from java.net.http.HttpClient", () => {
    const root = createTestTempDir("c2a-java-jdk-http-");
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
      path.join(javaDir, "JdkOrderClient.java"),
      `package com.example;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;

public class JdkOrderClient {
    private final HttpClient client = HttpClient.newHttpClient();

    public void fetch() throws Exception {
        client.send(
            HttpRequest.newBuilder().uri(URI.create("/api/orders")).build(),
            null
        );
    }
}
`,
    );

    const { store } = createMavenStore(root, "scan-jdk-http");
    const processor = new JavaRestClientProgrammaticProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "JdkOrderClient");
    assert.equal(clients[0]?.clientLibrary, "java-http");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/orders"]);
  });

  it("creates RestClient from RestTemplate with UriComponentsBuilder", () => {
    const root = createTestTempDir("c2a-java-uri-components-");
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

import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

public class OrderClient {
    private final RestTemplate restTemplate = new RestTemplate();

    public String fetch() {
        return restTemplate.getForObject(
            UriComponentsBuilder.fromHttpUrl("http://host").path("/api/orders").toUriString(),
            String.class
        );
    }
}
`,
    );

    const { store } = createMavenStore(root, "scan-uri-components");
    const processor = new JavaRestClientProgrammaticProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.clientLibrary, "rest-template");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/orders"]);
  });

  it("creates RestClient from OkHttpClient", () => {
    const root = createTestTempDir("c2a-java-okhttp-");
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
      path.join(javaDir, "OkOrderClient.java"),
      `package com.example;

import okhttp3.OkHttpClient;
import okhttp3.Request;

public class OkOrderClient {
    private final OkHttpClient client = new OkHttpClient();

    public void fetch() throws Exception {
        client.newCall(new Request.Builder().url("/api/orders").build()).execute();
    }
}
`,
    );

    const { store } = createMavenStore(root, "scan-java-okhttp");
    const processor = new JavaRestClientProgrammaticProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "OkOrderClient");
    assert.equal(clients[0]?.clientLibrary, "okhttp");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/orders"]);
  });

  it("creates RestClient from Spring WebClient", () => {
    const root = createTestTempDir("c2a-java-webclient-");
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
      path.join(javaDir, "ApiWebclient.java"),
      `package com.example;

import org.springframework.web.reactive.function.client.WebClient;

public class ApiWebclient {
    private final WebClient webClient = WebClient.create();

    public void fetch() {
        webClient.get().uri("/api/items").retrieve();
    }
}
`,
    );

    const { store } = createMavenStore(root, "scan-java-webclient");
    const processor = new JavaRestClientProgrammaticProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "ApiWebclient");
    assert.equal(clients[0]?.clientLibrary, "webclient");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/items"]);
  });

  it("creates RestClient from Spring RestClient", () => {
    const root = createTestTempDir("c2a-java-spring-rest-client-");
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

import org.springframework.web.client.RestClient;

public class OrderClient {
    private final RestClient restClient = RestClient.create();

    public void fetch() {
        restClient.get().uri("/api/orders").retrieve();
    }
}
`,
    );

    const { store } = createMavenStore(root, "scan-spring-rest-client");
    const processor = new JavaRestClientProgrammaticProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "OrderClient");
    assert.equal(clients[0]?.clientLibrary, "spring-rest-client");
    assert.deepEqual(clients[0]?.endpoints, ["GET /api/orders"]);
  });

  it("creates RestClient from Apache HttpClient with UriComponentsBuilder and path constants", () => {
    const root = createTestTempDir("c2a-java-apache-uri-constants-");
    const javaDir = path.join(root, "src", "main", "java", "com", "example", "restclient");
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
      path.join(javaDir, "AgentBillingServiceRestClientImpl.java"),
      `package com.example.restclient;

import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.DefaultHttpClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.HashMap;
import java.util.Map;

public class AgentBillingServiceRestClientImpl {
    private static final String AGENT_BILLING_CREATE_CHARGE = "/charge";
    private static final String AGENT_BILLING_GET_ACT = "/act/{year}/{month}/{agentId}";

    private String baseUrl;

    public AgentBillingServiceRestClientImpl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String createCharge() {
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(baseUrl).path(AGENT_BILLING_CREATE_CHARGE);
        String url = builder.build().toUriString();

        try {
            HttpClient httpClient = new DefaultHttpClient();
            HttpPost httpPost = new HttpPost(url);
            HttpResponse response = httpClient.execute(httpPost);
            return String.valueOf(response.getStatusLine().getStatusCode());
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    public String getAct(Integer year, Integer month, String agentId) {
        Map<String, Object> params = new HashMap<>();
        params.put("year", year);
        params.put("month", month);
        params.put("agentId", agentId);
        return getActDTO(AGENT_BILLING_GET_ACT, params);
    }

    private String getActDTO(String agentBillingGetAct, Map<String, Object> params) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(baseUrl).path(agentBillingGetAct);
        String url = builder.buildAndExpand(params).toUriString();

        try {
            HttpClient httpClient = new DefaultHttpClient();
            HttpGet httpGet = new HttpGet(url);
            HttpResponse response = httpClient.execute(httpGet);
            return String.valueOf(response.getStatusLine().getStatusCode());
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }
}
`,
    );

    const { store } = createMavenStore(root, "scan-apache-uri-constants");
    const processor = new JavaRestClientProgrammaticProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "AgentBillingServiceRestClientImpl");
    assert.equal(clients[0]?.clientLibrary, "apache-http");
    assert.deepEqual(clients[0]?.endpoints, ["GET /act/:year/:month/:agentId", "POST /charge"]);
  });

  it("creates RestClient from PrimeServiceImpl with contract and payload types", () => {
    const root = createTestTempDir("c2a-java-prime-service-");
    const javaDir = path.join(root, "src", "main", "java", "com", "example");
    mkdirSync(javaDir, { recursive: true });
    writeFileSync(path.join(root, "pom.xml"), mavenPom());
    writeFileSync(
      path.join(javaDir, "PrimeService.java"),
      `package com.example;

public interface PrimeService {
    CompanyRegData getCompanyRegData(String inn);
    CompanyAccReportStatus getCompanyAccountReportXml(String inn, String year);
}
`,
    );
    writeFileSync(
      path.join(javaDir, "CompanyRegData.java"),
      `package com.example;

public class CompanyRegData {}
`,
    );
    writeFileSync(
      path.join(javaDir, "CompanyAccReportStatus.java"),
      `package com.example;

public class CompanyAccReportStatus {}
`,
    );
    writeFileSync(
      path.join(javaDir, "PrimeServiceImpl.java"),
      `package com.example;

import org.springframework.web.client.RestTemplate;

public class PrimeServiceImpl implements PrimeService {
    private final RestTemplate restTemplate;

    public PrimeServiceImpl(String baseUrl) {
        this.restTemplate = new RestTemplate();
    }

    @Override
    public CompanyRegData getCompanyRegData(String inn) {
        return restTemplate.getForObject("/company-reg-data", CompanyRegData.class);
    }

    @Override
    public CompanyAccReportStatus getCompanyAccountReportXml(String inn, String year) {
        return restTemplate.getForObject("/account-report-xml", CompanyAccReportStatus.class);
    }
}
`,
    );

    const { store } = createMavenStore(root, "scan-prime-service");
    const processor = new JavaRestClientProgrammaticProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "PrimeServiceImpl");
    assert.equal(clients[0]?.symbolKey, "com.example.PrimeServiceImpl");
    assert.deepEqual(
      clients[0]?.inheritedContractTypes.map((type) => type.qualifiedName),
      ["com.example.PrimeService"],
    );
    assert.deepEqual(
      clients[0]?.payloadTypes.map((type) => type.qualifiedName).sort(),
      ["com.example.CompanyAccReportStatus", "com.example.CompanyRegData"],
    );
    assert.deepEqual(clients[0]?.endpoints, ["GET /account-report-xml", "GET /company-reg-data"]);
  });

  it("creates RestClient from IntegrationServiceHttpImpl with apache contract and payload types", () => {
    const root = createTestTempDir("c2a-java-integration-http-");
    const javaDir = path.join(root, "src", "main", "java", "com", "example");
    mkdirSync(javaDir, { recursive: true });
    writeFileSync(path.join(root, "pom.xml"), mavenPom());
    writeFileSync(
      path.join(javaDir, "IntegrationService.java"),
      `package com.example;

public interface IntegrationService {
    ZgrConfirmation upload(ZgrBankGuarantee bankGuarantee) throws Exception;
    ZgrConfirmation getConfirmation(String refId) throws Exception;
}
`,
    );
    writeFileSync(
      path.join(javaDir, "ZgrBankGuarantee.java"),
      `package com.example;

public class ZgrBankGuarantee {}
`,
    );
    writeFileSync(
      path.join(javaDir, "ZgrConfirmation.java"),
      `package com.example;

public class ZgrConfirmation {
    public ZgrConfirmation(String body) {}
}
`,
    );
    writeFileSync(
      path.join(javaDir, "IntegrationServiceHttpImpl.java"),
      `package com.example;

import org.apache.http.HttpEntity;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.CloseableHttpClient;

public class IntegrationServiceHttpImpl implements IntegrationService {
    private final CloseableHttpClient httpClient;
    private final String baseUrl;

    public IntegrationServiceHttpImpl(CloseableHttpClient httpClient, String baseUrl) {
        this.httpClient = httpClient;
        this.baseUrl = baseUrl;
    }

    @Override
    public ZgrConfirmation upload(ZgrBankGuarantee bankGuarantee) throws Exception {
        HttpPost post = new HttpPost(baseUrl + "/upload");
        return new ZgrConfirmation(post(httpClient.execute(post).getEntity()));
    }

    @Override
    public ZgrConfirmation getConfirmation(String refId) throws Exception {
        HttpPost post = new HttpPost(baseUrl + "/uploadResult");
        return new ZgrConfirmation(post(httpClient.execute(post).getEntity()));
    }

    private String post(HttpEntity entity) {
        return "ok";
    }
}
`,
    );

    const { store } = createMavenStore(root, "scan-integration-http");
    const processor = new JavaRestClientProgrammaticProcessor();
    const output = processor.process(store.snapshot());
    const clients = output.entities?.HttpClientApi ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "IntegrationServiceHttpImpl");
    assert.deepEqual(
      clients[0]?.inheritedContractTypes.map((type) => type.qualifiedName),
      ["com.example.IntegrationService"],
    );
    assert.deepEqual(
      clients[0]?.payloadTypes.map((type) => type.qualifiedName).sort(),
      ["com.example.ZgrBankGuarantee", "com.example.ZgrConfirmation"],
    );
    assert.deepEqual(clients[0]?.endpoints, ["POST /upload", "POST /uploadResult"]);
  });
});

function mavenPom(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>app</artifactId>
  <version>1.0.0</version>
</project>`;
}

function createMavenStore(root: string, scanId: string): { store: RunEntityStore } {
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
    scanId,
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
