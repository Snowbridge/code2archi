import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/discovery-model/entities/application-module.js";
import { RunEntityStore } from "../../../../../../src/discovery-model/run-entity-store.js";
import { JavaRestControllerFunctionalRouterBasedProcessor } from "../../../../../../src/processors/scan/source/java/rest/controller-functional-router-based-processor.js";
import { Repository } from "../../../../../../src/discovery-model/entities/repository.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

const functionalFixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../fixtures/java-rest-controllers/functional",
);

function readFunctionalFixture(name: string): string {
  return readFileSync(path.join(functionalFixturesDir, name), "utf8");
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
  <properties>
    <maven.compiler.source>17</maven.compiler.source>
  </properties>
</project>`,
  );
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
    "scan.source",
    { groupId: "scan.source.assembly.maven", artifactId: "test" },
    { entities: { ApplicationModule: [module] } },
  );

  return store;
}

describe("JavaRestControllerFunctionalRouterBasedProcessor", () => {
  it("creates RestController entities from RouterFunction bean methods", () => {
    const root = createTestTempDir("c2a-functional-router-");
    const javaDir = path.join(root, "src", "main", "java", "com", "example");
    mkdirSync(javaDir, { recursive: true });
    writeMavenPom(root);
    writeFileSync(
      path.join(javaDir, "UserRouterConfig.java"),
      readFunctionalFixture("user-router-config.java"),
    );

    const store = createMavenStore(root, "scan-functional-router");
    const output = new JavaRestControllerFunctionalRouterBasedProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "userRoutes");
    assert.equal(controllers[0]?.fqcn, "com.example.UserRouterConfig#userRoutes");
    assert.equal(controllers[0]?.programmingModel, "FUNCTIONAL");
    assert.deepEqual(controllers[0]?.endpoints, [
      "GET /users",
      "GET /users/:id",
      "PUT /users/:id",
    ]);
    assert.equal(controllers[0]?.tcpStackType, "NON_BLOCKING");
  });

  it("creates RestController entities from RouterFunction field initializers", () => {
    const root = createTestTempDir("c2a-functional-router-field-");
    const javaDir = path.join(root, "src", "main", "java", "com", "example");
    mkdirSync(javaDir, { recursive: true });
    writeMavenPom(root);
    writeFileSync(
      path.join(javaDir, "FieldRouterConfig.java"),
      readFunctionalFixture("spring-router-field.java"),
    );

    const store = createMavenStore(root, "scan-functional-router-field");
    const output = new JavaRestControllerFunctionalRouterBasedProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "userRoutes");
    assert.equal(controllers[0]?.fqcn, "com.example.FieldRouterConfig#userRoutes");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /users", "GET /users/:id"]);
  });

  it("creates RestController from RouterFunctions.route and andRoute", () => {
    const root = createTestTempDir("c2a-functional-and-route-");
    const javaDir = path.join(root, "src", "main", "java", "com", "example");
    mkdirSync(javaDir, { recursive: true });
    writeMavenPom(root);
    writeFileSync(
      path.join(javaDir, "CombinedRouterConfig.java"),
      readFunctionalFixture("router-functions-and-route.java"),
    );

    const store = createMavenStore(root, "scan-functional-and-route");
    const output = new JavaRestControllerFunctionalRouterBasedProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "combinedRoutes");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /users", "POST /users"]);
  });

  it("creates RestController from Micronaut RouteBuilder", () => {
    const root = createTestTempDir("c2a-functional-micronaut-");
    const javaDir = path.join(root, "src", "main", "java", "com", "example");
    mkdirSync(javaDir, { recursive: true });
    writeMavenPom(root);
    writeFileSync(
      path.join(javaDir, "MyRoutes.java"),
      readFunctionalFixture("micronaut-default-route-builder.java"),
    );

    const store = createMavenStore(root, "scan-functional-micronaut");
    const output = new JavaRestControllerFunctionalRouterBasedProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "issuesRoutes");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /issues/show/:number"]);
  });

  it("creates RestController from Quarkus Vert.x Router", () => {
    const root = createTestTempDir("c2a-functional-quarkus-vertx-");
    const javaDir = path.join(root, "src", "main", "java", "com", "example");
    mkdirSync(javaDir, { recursive: true });
    writeMavenPom(root);
    writeFileSync(path.join(javaDir, "MyRoutes.java"), readFunctionalFixture("quarkus-vertx-router.java"));

    const store = createMavenStore(root, "scan-functional-quarkus-vertx");
    const output = new JavaRestControllerFunctionalRouterBasedProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "init");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /hello", "POST /items"]);
  });

  it("creates RestController from Quarkus @Route class", () => {
    const root = createTestTempDir("c2a-functional-quarkus-route-");
    const javaDir = path.join(root, "src", "main", "java", "com", "example");
    mkdirSync(javaDir, { recursive: true });
    writeMavenPom(root);
    writeFileSync(
      path.join(javaDir, "ReactiveRoutes.java"),
      readFunctionalFixture("quarkus-reactive-routes.java"),
    );

    const store = createMavenStore(root, "scan-functional-quarkus-route");
    const output = new JavaRestControllerFunctionalRouterBasedProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "ReactiveRoutes");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /hello", "GET /world"]);
  });
});
