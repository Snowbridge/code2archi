import assert from "node:assert/strict";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/code-inventory/entities/application-module.js";
import { RunEntityStore } from "../../../../../../src/code-inventory/run-entity-store.js";
import { SpringWebMvcProcessor } from "../../../../../../src/processors/scan/extract/rest/controllers/spring-webmvc-processor.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../fixtures/jvm/rest/spring",
);

describe("SpringWebMvcProcessor", () => {
  it("discovers RestController, contract, and DTO from Java sources", () => {
    const root = createTestTempDir("c2a-spring-webmvc-");
    writeFileSync(path.join(root, "settings.gradle"), `rootProject.name = 'demo'`);
    writeFileSync(
      path.join(root, "build.gradle"),
      `group = 'com.example'
version = '1.0.0'`,
    );
    const sourceDir = path.join(root, "src", "main", "java", "com", "example", "api");
    mkdirSync(sourceDir, { recursive: true });
    for (const fileName of ["UserController.java", "UserContract.java", "UserDto.java"]) {
      cpSync(path.join(FIXTURES_DIR, fileName), path.join(sourceDir, fileName));
    }

    const store = new RunEntityStore({
      sourceDirs: [root],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });
    const module = new ApplicationModule({
      repositoryId: "repo-1",
      buildSystem: "gradle",
      groupId: "com.example",
      artifactId: "demo",
      version: "1.0.0",
      name: "demo",
      repoPath: "",
      buildScript: "build.gradle",
      isMultimodule: false,
    });
    store.addCreateIntents(
      "scan.scope",
      { groupId: "scan.scope", artifactId: "test" },
      {
        entities: {
          Repository: [
            {
              id: "repo-1",
              name: "demo",
              namespace: "",
              localPath: root,
              url: "",
              buildSystems: ["gradle"],
            },
          ],
        },
      },
    );
    store.addCreateIntents(
      "scan.extract",
      { groupId: "scan.extract", artifactId: "test" },
      {
        entities: {
          ApplicationModule: [module.toCreateIntent()],
        },
      },
    );

    const processor = new SpringWebMvcProcessor();
    const output = processor.process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];
    const contracts = output.entities?.HttpApiContract ?? [];
    const dataTypes = output.entities?.HttpApiDataType ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.simpleName, "UserController");
    assert.equal(controllers[0]?.fqcn, "com.example.api.UserController");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /api/users"]);
    assert.equal(contracts.length, 1);
    assert.equal(contracts[0]?.fqcn, "com.example.api.UserContract");
    assert.equal(dataTypes.length, 1);
    assert.equal(dataTypes[0]?.fqcn, "com.example.api.UserDto");
    assert.equal(controllers[0]?.contractIds[0], contracts[0]?.id);
    assert.equal(controllers[0]?.dataTypeIds[0], dataTypes[0]?.id);
  });
});
