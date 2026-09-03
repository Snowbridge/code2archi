import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/discovery-model/entities/application-module.js";
import { RunEntityStore } from "../../../../../../src/discovery-model/run-entity-store.js";
import { JavaRestControllerAnnotationBasedProcessor } from "../../../../../../src/processors/scan/source/java/rest/controller-annotation-based-processor.js";
import { Repository } from "../../../../../../src/discovery-model/entities/repository.js";
import { UNKNOWN_VERSION } from "../../../../../../src/parsers/build-tool-versions.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

const javaFixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../fixtures/java-rest-controllers",
);

function readJavaFixture(name: string): string {
  return readFileSync(path.join(javaFixturesDir, name), "utf8");
}

function createMavenStore(root: string, scanId: string): { module: ApplicationModule; store: RunEntityStore } {
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

describe("JavaRestControllerAnnotationBasedProcessor", () => {
  it("creates RestController entities from maven module java sources", () => {
    const root = createTestTempDir("c2a-annotation-based-");
    const javaDir = path.join(root, "src", "main", "java", "com", "example");
    mkdirSync(javaDir, { recursive: true });
    writeMavenPom(root);
    writeFileSync(
      path.join(javaDir, "EntityController.java"),
      `package com.example;

import com.example.dto.EntityDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/entity")
public class EntityController {
    @PutMapping("/{id}")
    public ResponseEntity<EntityDto> update(@RequestBody EntityDto dto) { }
}
`,
    );

    const { module, store } = createMavenStore(root, "scan-annotation-based");
    const processor = new JavaRestControllerAnnotationBasedProcessor();
    const output = processor.process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "EntityController");
    assert.equal(controllers[0]?.applicationModuleId, module.id);
    assert.equal(controllers[0]?.sourceFile, "src/main/java/com/example/EntityController.java");
    assert.deepEqual(controllers[0]?.endpoints, ["PUT /api/entity/:id"]);
    assert.equal(controllers[0]?.tcpStackType, "BLOCKING");
    assert.equal(controllers[0]?.programmingModel, "DECLARATIVE");
  });

  it("skips npm modules and modules with unknown java version", () => {
    const root = createTestTempDir("c2a-annotation-based-skip-");
    const repository = new Repository({
      url: "",
      localPath: root,
      name: "app",
      namespace: "",
      buildSystems: ["npm"],
    });
    const npmModule = new ApplicationModule({
      repositoryId: repository.id,
      buildSystem: "npm",
      groupId: "com.example",
      artifactId: "app",
      version: "1.0.0",
      name: "app",
      repoPath: ".",
      buildScript: "package.json",
      isMultimodule: false,
      javaVersion: UNKNOWN_VERSION,
    });
    const unknownJavaModule = new ApplicationModule({
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
    });

    const store = new RunEntityStore({
      sourceDirs: [root],
      scanId: "scan-annotation-based-skip",
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
      { entities: { ApplicationModule: [npmModule, unknownJavaModule] } },
    );

    const processor = new JavaRestControllerAnnotationBasedProcessor();
    const output = processor.process(store.snapshot());

    assert.equal(output.entities?.RestController?.length ?? 0, 0);
  });

  it("creates RestController from Micronaut @Controller", () => {
    const root = createTestTempDir("c2a-annotation-micronaut-");
    const javaDir = path.join(root, "src", "main", "java", "com", "example");
    mkdirSync(javaDir, { recursive: true });
    writeMavenPom(root);
    writeFileSync(path.join(javaDir, "UserController.java"), readJavaFixture("micronaut-user-controller.java"));

    const { store } = createMavenStore(root, "scan-annotation-micronaut");
    const processor = new JavaRestControllerAnnotationBasedProcessor();
    const output = processor.process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "UserController");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /api/users/:id"]);
    assert.equal(controllers[0]?.programmingModel, "DECLARATIVE");
  });

  it("creates RestController from Quarkus JAX-RS @Path", () => {
    const root = createTestTempDir("c2a-annotation-quarkus-");
    const javaDir = path.join(root, "src", "main", "java", "com", "example");
    mkdirSync(javaDir, { recursive: true });
    writeMavenPom(root);
    writeFileSync(path.join(javaDir, "ItemResource.java"), readJavaFixture("quarkus-jaxrs-resource.java"));

    const { store } = createMavenStore(root, "scan-annotation-quarkus");
    const processor = new JavaRestControllerAnnotationBasedProcessor();
    const output = processor.process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "ItemResource");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /v1/items/:id"]);
    assert.equal(controllers[0]?.programmingModel, "DECLARATIVE");
  });
});
