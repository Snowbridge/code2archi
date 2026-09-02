import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../src/discovery-model/entities/application-module.js";
import { RunEntityStore } from "../../../src/discovery-model/run-entity-store.js";
import { Repository } from "../../../src/discovery-model/entities/repository.js";
import { KotlinKtorAndRouterBasedProcessor } from "../../../src/processors/scan.source/kotlin-ktor-and-router-based-processor.js";
import { createTestTempDir } from "../../test-temp-dir.js";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/kotlin-rest-controllers/functional/spring-router-function-bean.kt",
);

describe("KotlinKtorAndRouterBasedProcessor", () => {
  it("creates RestController entities from Kotlin RouterFunction @Bean", () => {
    const root = createTestTempDir("c2a-kotlin-functional-router-");
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
    writeFileSync(path.join(kotlinDir, "UserRouterConfig.kt"), readFileSync(fixturePath, "utf8"));

    const repository = new Repository({
      url: "",
      localPath: root,
      name: "app",
      namespace: "",
      buildSystems: ["gradle"],
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
      scanId: "scan-kotlin-functional-router",
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

    const processor = new KotlinKtorAndRouterBasedProcessor();
    const output = processor.process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "userRoutes");
    assert.equal(controllers[0]?.fqcn, "com.example.UserRouterConfig#userRoutes");
    assert.equal(controllers[0]?.programmingModel, "FUNCTIONAL");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /users", "GET /users/:id"]);
    assert.match(controllers[0]?.sourceFile ?? "", /\.kt$/);
  });
});
