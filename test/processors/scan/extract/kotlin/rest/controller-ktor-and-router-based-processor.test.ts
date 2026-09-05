import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/discovery-model/entities/application-module.js";
import { RunEntityStore } from "../../../../../../src/discovery-model/run-entity-store.js";
import { Repository } from "../../../../../../src/discovery-model/entities/repository.js";
import { KotlinRestControllerKtorAndRouterBasedProcessor } from "../../../../../../src/processors/scan/extract/kotlin/rest/controller-ktor-and-router-based-processor.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

const functionalFixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../fixtures/kotlin-rest-controllers/functional",
);

function readFunctionalFixture(name: string): string {
  return readFileSync(path.join(functionalFixturesDir, name), "utf8");
}

function createMavenStore(root: string, scanId: string): RunEntityStore {
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
    kotlinJvmTarget: "17",
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

  return store;
}

function writeMavenPom(root: string): void {
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
}

describe("KotlinRestControllerKtorAndRouterBasedProcessor", () => {
  it("creates RestController entities from Kotlin RouterFunction @Bean", () => {
    const root = createTestTempDir("c2a-kotlin-functional-router-");
    const kotlinDir = path.join(root, "src", "main", "kotlin", "com", "example");
    mkdirSync(kotlinDir, { recursive: true });
    writeMavenPom(root);
    writeFileSync(
      path.join(kotlinDir, "UserRouterConfig.kt"),
      readFunctionalFixture("spring-router-function-bean.kt"),
    );

    const store = createMavenStore(root, "scan-kotlin-functional-router");
    const output = new KotlinRestControllerKtorAndRouterBasedProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "userRoutes");
    assert.equal(controllers[0]?.fqcn, "com.example.UserRouterConfig#userRoutes");
    assert.equal(controllers[0]?.programmingModel, "FUNCTIONAL");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /users", "GET /users/:id"]);
    assert.match(controllers[0]?.sourceFile ?? "", /\.kt$/);
  });

  it("creates RestController from route().GET().build() chained builder", () => {
    const root = createTestTempDir("c2a-kotlin-chained-router-");
    const kotlinDir = path.join(root, "src", "main", "kotlin", "com", "example");
    mkdirSync(kotlinDir, { recursive: true });
    writeMavenPom(root);
    writeFileSync(
      path.join(kotlinDir, "UserRouterConfig.kt"),
      readFunctionalFixture("spring-router-chained-builder.kt"),
    );

    const store = createMavenStore(root, "scan-kotlin-chained-router");
    const output = new KotlinRestControllerKtorAndRouterBasedProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "userRoutes");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /users", "GET /users/:id"]);
  });

  it("creates RestController from CoRouterFunction @Bean", () => {
    const root = createTestTempDir("c2a-kotlin-co-router-");
    const kotlinDir = path.join(root, "src", "main", "kotlin", "com", "example");
    mkdirSync(kotlinDir, { recursive: true });
    writeMavenPom(root);
    writeFileSync(
      path.join(kotlinDir, "CoRouterConfig.kt"),
      readFunctionalFixture("spring-co-router-bean.kt"),
    );

    const store = createMavenStore(root, "scan-kotlin-co-router");
    const output = new KotlinRestControllerKtorAndRouterBasedProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "coRoutes");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /items"]);
    assert.equal(controllers[0]?.tcpStackType, "NON_BLOCKING");
  });

  it("creates RestController from Ktor routing host", () => {
    const root = createTestTempDir("c2a-kotlin-ktor-routing-");
    const kotlinDir = path.join(root, "src", "main", "kotlin", "com", "example");
    mkdirSync(kotlinDir, { recursive: true });
    writeMavenPom(root);
    writeFileSync(
      path.join(kotlinDir, "Application.kt"),
      readFunctionalFixture("ktor-routing-host.kt"),
    );

    const store = createMavenStore(root, "scan-kotlin-ktor-routing");
    const output = new KotlinRestControllerKtorAndRouterBasedProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "module");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /hello"]);
  });

  it("creates RestController from Micronaut RouteBuilder", () => {
    const root = createTestTempDir("c2a-kotlin-micronaut-route-");
    const kotlinDir = path.join(root, "src", "main", "kotlin", "com", "example");
    mkdirSync(kotlinDir, { recursive: true });
    writeMavenPom(root);
    writeFileSync(
      path.join(kotlinDir, "MyRoutes.kt"),
      readFunctionalFixture("micronaut-route-builder.kt"),
    );

    const store = createMavenStore(root, "scan-kotlin-micronaut-route");
    const output = new KotlinRestControllerKtorAndRouterBasedProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "issuesRoutes");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /issues/show/:number"]);
  });

  it("creates RestController from Quarkus @Route class", () => {
    const root = createTestTempDir("c2a-kotlin-quarkus-route-");
    const kotlinDir = path.join(root, "src", "main", "kotlin", "com", "example");
    mkdirSync(kotlinDir, { recursive: true });
    writeMavenPom(root);
    writeFileSync(
      path.join(kotlinDir, "ReactiveRoutes.kt"),
      readFunctionalFixture("quarkus-reactive-routes.kt"),
    );

    const store = createMavenStore(root, "scan-kotlin-quarkus-route");
    const output = new KotlinRestControllerKtorAndRouterBasedProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "ReactiveRoutes");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /hello", "GET /world"]);
  });
});
