import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import "../../src/platform/processors/builtin-processors.js";
import {
  APPLICATION_MODULE_DEPENDENCY_SCHEMA_ID,
  APPLICATION_MODULE_SCHEMA_ID,
  REPOSITORY_SCHEMA_ID,
} from "../../src/discovery-model/discovery-model-writer.js";
import { packageVersion } from "../../src/package-version.js";
import { runScanFlow } from "../../src/scan/run-scan-flow.js";
import { createTestTempDir } from "../test-temp-dir.js";

function createGitRepo(dir: string): void {
  mkdirSync(path.join(dir, ".git"), { recursive: true });
}

describe("runScanFlow", () => {
  it("writes discovery-model after scan.scope", () => {
    const root = createTestTempDir("c2a-scan-flow-");
    const sourceDir = path.join(root, "src");
    const outputDir = path.join(root, "out");
    mkdirSync(sourceDir);
    mkdirSync(outputDir);

    runScanFlow({
      sourceDirs: [sourceDir],
      outputDir,
      force: false,
      scanId: "test-scan-id",
      runStartedAt: new Date("2026-08-27T09:00:00.000Z"),
      processorFilters: {
        with: ["scan.scope.unversioned-folders"],
        without: [],
        withOnly: [],
      },
    });

    const manifestPath = path.join(outputDir, "manifest.json");
    const repositoriesPath = path.join(outputDir, "repositories.json");
    assert.ok(existsSync(manifestPath));
    assert.ok(existsSync(repositoriesPath));

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      formatVersion: string;
      scanId: string;
      collections: Array<{ path: string; schema: string }>;
    };
    assert.equal(manifest.formatVersion, packageVersion);
    assert.equal(manifest.scanId, "test-scan-id");
    assert.equal(manifest.collections[0]?.path, "repositories.json");
    assert.equal(manifest.collections[0]?.schema, REPOSITORY_SCHEMA_ID);

    const repositories = JSON.parse(readFileSync(repositoriesPath, "utf8")) as Array<{
      name: string;
    }>;
    assert.equal(repositories.length, 1);
    assert.equal(repositories[0]?.name, "src");
    assert.equal(repositories[0]?.namespace, "");
  });

  it("finalizes repository namespace from common root before scan.source", () => {
    const root = createTestTempDir("c2a-scan-flow-ns-");
    const sourceDir = path.join(root, "fizz");
    const repoDir = path.join(sourceDir, "fuzz", "bar", "buzz", "flow-app");
    const secondRepoDir = path.join(sourceDir, "other", "second-app");
    const outputDir = path.join(root, "out");
    mkdirSync(repoDir, { recursive: true });
    mkdirSync(secondRepoDir, { recursive: true });
    mkdirSync(outputDir);
    createGitRepo(repoDir);
    createGitRepo(secondRepoDir);
    writeFileSync(
      path.join(repoDir, "pom.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.flow</groupId>
  <artifactId>flow-app</artifactId>
  <version>1.0.0</version>
</project>`,
    );

    runScanFlow({
      sourceDirs: [sourceDir],
      outputDir,
      force: false,
      scanId: "test-scan-namespace",
      runStartedAt: new Date("2026-08-27T09:00:00.000Z"),
      processorFilters: {
        with: [],
        without: ["scan.scope.unversioned-folders"],
        withOnly: [],
      },
    });

    const repositories = JSON.parse(
      readFileSync(path.join(outputDir, "repositories.json"), "utf8"),
    ) as Array<{ name: string; namespace: string }>;
    assert.equal(repositories.length, 2);
    const flowApp = repositories.find((repository) => repository.name === "flow-app");
    assert.equal(flowApp?.namespace, "fuzz/bar/buzz");
  });

  it("writes application modules after scan.source for maven repository", () => {
    const root = createTestTempDir("c2a-scan-flow-maven-");
    const sourceDir = path.join(root, "src");
    const outputDir = path.join(root, "out");
    mkdirSync(sourceDir);
    mkdirSync(outputDir);
    writeFileSync(
      path.join(sourceDir, "pom.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.flow</groupId>
  <artifactId>flow-app</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>com.lib</groupId>
      <artifactId>shared</artifactId>
      <version>1.0.0</version>
    </dependency>
  </dependencies>
</project>`,
    );

    runScanFlow({
      sourceDirs: [sourceDir],
      outputDir,
      force: false,
      scanId: "test-scan-maven",
      runStartedAt: new Date("2026-08-27T09:00:00.000Z"),
      processorFilters: {
        with: ["scan.scope.unversioned-folders"],
        without: [],
        withOnly: [],
      },
    });

    const modulesPath = path.join(outputDir, "application-modules.json");
    const dependenciesPath = path.join(outputDir, "application-module-dependencies.json");
    assert.ok(existsSync(modulesPath));
    assert.ok(existsSync(dependenciesPath));

    const manifest = JSON.parse(readFileSync(path.join(outputDir, "manifest.json"), "utf8")) as {
      collections: Array<{ path: string; schema: string }>;
    };
    assert.ok(
      manifest.collections.some(
        (collection) =>
          collection.path === "application-modules.json" &&
          collection.schema === APPLICATION_MODULE_SCHEMA_ID,
      ),
    );
    assert.ok(
      manifest.collections.some(
        (collection) =>
          collection.path === "application-module-dependencies.json" &&
          collection.schema === APPLICATION_MODULE_DEPENDENCY_SCHEMA_ID,
      ),
    );

    const modules = JSON.parse(readFileSync(modulesPath, "utf8")) as Array<{
      artifactId: string;
      buildSystem: string;
    }>;
    const dependencies = JSON.parse(readFileSync(dependenciesPath, "utf8")) as Array<{
      artifactId: string;
    }>;
    assert.equal(modules.length, 1);
    assert.equal(modules[0]?.artifactId, "flow-app");
    assert.equal(modules[0]?.buildSystem, "maven");
    assert.equal(dependencies.length, 1);
    assert.equal(dependencies[0]?.artifactId, "shared");
  });

  it("discovers RestController entities after maven modules are scanned in scan.source", () => {
    const root = createTestTempDir("c2a-scan-flow-rest-");
    const sourceDir = path.join(root, "src");
    const javaDir = path.join(sourceDir, "src", "main", "java", "com", "flow");
    const outputDir = path.join(root, "out");
    mkdirSync(javaDir, { recursive: true });
    mkdirSync(outputDir);
    writeFileSync(
      path.join(sourceDir, "pom.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.flow</groupId>
  <artifactId>flow-app</artifactId>
  <version>1.0.0</version>
  <properties>
    <maven.compiler.source>17</maven.compiler.source>
  </properties>
</project>`,
    );
    writeFileSync(
      path.join(javaDir, "FlowController.java"),
      `package com.flow;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class FlowController {
    @GetMapping("/flow")
    public String flow() { return "ok"; }
}
`,
    );

    runScanFlow({
      sourceDirs: [sourceDir],
      outputDir,
      force: false,
      scanId: "test-scan-rest-controllers",
      runStartedAt: new Date("2026-08-27T09:00:00.000Z"),
      processorFilters: {
        with: ["scan.scope.unversioned-folders"],
        without: [],
        withOnly: [],
      },
    });

    const controllersPath = path.join(outputDir, "rest-controllers.json");
    assert.ok(existsSync(controllersPath));

    const controllers = JSON.parse(readFileSync(controllersPath, "utf8")) as Array<{
      name: string;
      endpoints: string[];
      programmingModel: string;
    }>;
    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "FlowController");
    assert.deepEqual(controllers[0]?.endpoints, ["GET /flow"]);
    assert.equal(controllers[0]?.programmingModel, "DECLARATIVE");
  });

  it("discovers functional RouterFunction controllers in scan.source", () => {
    const root = createTestTempDir("c2a-scan-flow-functional-");
    const sourceDir = path.join(root, "src");
    const javaDir = path.join(sourceDir, "src", "main", "java", "com", "example");
    const outputDir = path.join(root, "out");
    mkdirSync(javaDir, { recursive: true });
    mkdirSync(outputDir);
    writeFileSync(
      path.join(sourceDir, "pom.xml"),
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
    writeFileSync(
      path.join(javaDir, "UserRouterConfig.java"),
      readFileSync(
        path.join(
          path.dirname(fileURLToPath(import.meta.url)),
          "../fixtures/java-rest-controllers/functional/user-router-config.java",
        ),
        "utf8",
      ),
    );

    runScanFlow({
      sourceDirs: [sourceDir],
      outputDir,
      force: false,
      scanId: "test-scan-functional-router",
      runStartedAt: new Date("2026-08-27T09:00:00.000Z"),
      processorFilters: {
        with: ["scan.scope.unversioned-folders"],
        without: [],
        withOnly: [],
      },
    });

    const controllers = JSON.parse(
      readFileSync(path.join(outputDir, "rest-controllers.json"), "utf8"),
    ) as Array<{ name: string; programmingModel: string; fqcn: string }>;

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "userRoutes");
    assert.equal(controllers[0]?.programmingModel, "FUNCTIONAL");
    assert.equal(controllers[0]?.fqcn, "com.example.UserRouterConfig#userRoutes");
  });
});
