import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../src/discovery-model/entities/application-module.js";
import { Repository } from "../../../src/discovery-model/entities/repository.js";
import { RunEntityStore } from "../../../src/discovery-model/run-entity-store.js";
import { UNKNOWN_VERSION } from "../../../src/parsers/build-tool-versions.js";
import { KotlinAnnotationBasedProcessor } from "../../../src/processors/scan.source/kotlin-annotation-based-processor.js";
import { createTestTempDir } from "../../test-temp-dir.js";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/kotlin-rest-controllers",
);

describe("KotlinAnnotationBasedProcessor", () => {
  it("creates RestController entities from maven module kotlin sources", () => {
    const root = createTestTempDir("c2a-kotlin-annotation-based-");
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
      path.join(kotlinDir, "EntityController.kt"),
      readFixture("spring-entity-controller.kt"),
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
      scanId: "scan-kotlin-annotation-based",
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

    const processor = new KotlinAnnotationBasedProcessor();
    const output = processor.process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "EntityController");
    assert.equal(controllers[0]?.applicationModuleId, module.id);
    assert.equal(controllers[0]?.sourceFile, "src/main/kotlin/com/example/EntityController.kt");
    assert.deepEqual(controllers[0]?.endpoints, ["PUT /api/entity/:id"]);
    assert.equal(controllers[0]?.tcpStackType, "BLOCKING");
    assert.equal(controllers[0]?.programmingModel, "DECLARATIVE");
  });

  it("accepts modules with kotlinJvmTarget when java version is unknown", () => {
    const root = createTestTempDir("c2a-kotlin-jvm-target-");
    const kotlinDir = path.join(root, "src", "main", "kotlin", "com", "example");
    mkdirSync(kotlinDir, { recursive: true });
    writeFileSync(
      path.join(root, "build.gradle"),
      "plugins { id 'org.jetbrains.kotlin.jvm' version '1.9.0' }",
    );
    writeFileSync(
      path.join(kotlinDir, "EntityController.kt"),
      readFixture("spring-entity-controller.kt"),
    );

    const repository = new Repository({
      url: "",
      localPath: root,
      name: "app",
      namespace: "",
      buildSystems: ["gradle"],
    });
    const module = new ApplicationModule({
      repositoryId: repository.id,
      buildSystem: "gradle",
      groupId: "com.example",
      artifactId: "app",
      version: "1.0.0",
      name: "app",
      repoPath: ".",
      buildScript: "build.gradle",
      isMultimodule: false,
      javaVersion: UNKNOWN_VERSION,
      kotlinJvmTarget: "17",
    });

    const store = new RunEntityStore({
      sourceDirs: [root],
      scanId: "scan-kotlin-jvm-target",
      runStartedAt: new Date("2026-09-01T12:00:00.000Z"),
    });
    store.addCreateIntents(
      "scan.scope",
      { groupId: "scan.scope", artifactId: "test" },
      { entities: { Repository: [repository] } },
    );
    store.addCreateIntents(
      "scan.source",
      { groupId: "scan.source.assembly.gradle", artifactId: "test" },
      { entities: { ApplicationModule: [module] } },
    );

    const processor = new KotlinAnnotationBasedProcessor();
    const output = processor.process(store.snapshot());

    assert.equal(output.entities?.RestController?.length ?? 0, 1);
  });

  it("skips modules without java or kotlin jvm target", () => {
    const root = createTestTempDir("c2a-kotlin-skip-");
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
      artifactId: "legacy",
      version: "1.0.0",
      name: "legacy",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
      javaVersion: UNKNOWN_VERSION,
      kotlinJvmTarget: UNKNOWN_VERSION,
    });

    const store = new RunEntityStore({
      sourceDirs: [root],
      scanId: "scan-kotlin-skip",
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

    const processor = new KotlinAnnotationBasedProcessor();
    const output = processor.process(store.snapshot());

    assert.equal(output.entities?.RestController?.length ?? 0, 0);
  });

  it("marks suspend handlers as NON_BLOCKING", () => {
    const root = createTestTempDir("c2a-kotlin-suspend-");
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
      path.join(kotlinDir, "FluxController.kt"),
      readFixture("spring-webflux-suspend-controller.kt"),
    );

    const { store } = createKotlinMavenStore(root, "scan-kotlin-suspend");
    const output = new KotlinAnnotationBasedProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.tcpStackType, "NON_BLOCKING");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /entities"]);
  });

  it("creates RestController from Quarkus JAX-RS @Path", () => {
    const root = createTestTempDir("c2a-kotlin-quarkus-jaxrs-");
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
    writeFileSync(path.join(kotlinDir, "ItemResource.kt"), readFixture("quarkus-jaxrs-resource.kt"));

    const { store } = createKotlinMavenStore(root, "scan-kotlin-quarkus-jaxrs");
    const output = new KotlinAnnotationBasedProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "ItemResource");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /v1/items/:id"]);
    assert.equal(controllers[0]?.programmingModel, "DECLARATIVE");
  });
});

function createKotlinMavenStore(
  root: string,
  scanId: string,
): { module: ApplicationModule; store: RunEntityStore } {
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

  return { module, store };
}

function readFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf8");
}
