import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../src/discovery-model/entities/application-module.js";
import { RunEntityStore } from "../../../src/discovery-model/run-entity-store.js";
import { FunctionalRouterBasedProcessor } from "../../../src/processors/scan.source/functional-router-based-processor.js";
import { Repository } from "../../../src/discovery-model/entities/repository.js";
import { createTestTempDir } from "../../test-temp-dir.js";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/java-rest-controllers/functional/user-router-config.java",
);

describe("FunctionalRouterBasedProcessor", () => {
  it("creates RestController entities from RouterFunction bean methods", () => {
    const root = createTestTempDir("c2a-functional-router-");
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
  <properties>
    <maven.compiler.source>17</maven.compiler.source>
  </properties>
</project>`,
    );
    writeFileSync(path.join(javaDir, "UserRouterConfig.java"), readFileSync(fixturePath, "utf8"));

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
      scanId: "scan-functional-router",
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

    const processor = new FunctionalRouterBasedProcessor();
    const output = processor.process(store.snapshot());
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
});
