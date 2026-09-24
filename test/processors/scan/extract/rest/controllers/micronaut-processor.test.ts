import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/code-inventory/entities/application-module.js";
import { RunEntityStore } from "../../../../../../src/code-inventory/run-entity-store.js";
import { MicronautProcessor } from "../../../../../../src/processors/scan/extract/rest/controllers/micronaut-processor.js";
import { SpringWebMvcProcessor } from "../../../../../../src/processors/scan/extract/rest/controllers/spring-webmvc-processor.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

const SPRING_KOTLIN_CONTROLLER = `package com.example.web

import com.example.api.DemoApi
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestMethod

@Controller
@RequestMapping("/api")
class DemoController : DemoApi {
    @RequestMapping(value = ["/ping"], method = [RequestMethod.GET])
    override fun ping(): String = "ok"
}
`;

const DEMO_API = `package com.example.api

interface DemoApi {
    fun ping(): String
}
`;

function seedStore(root: string): RunEntityStore {
  writeFileSync(path.join(root, "settings.gradle"), `rootProject.name = 'demo'`);
  writeFileSync(
    path.join(root, "build.gradle"),
    `group = 'com.example'
version = '1.0.0'`,
  );
  const apiDir = path.join(root, "src", "main", "kotlin", "com", "example", "api");
  const webDir = path.join(root, "src", "main", "kotlin", "com", "example", "web");
  mkdirSync(apiDir, { recursive: true });
  mkdirSync(webDir, { recursive: true });
  writeFileSync(path.join(apiDir, "DemoApi.kt"), DEMO_API);
  writeFileSync(path.join(webDir, "DemoController.kt"), SPRING_KOTLIN_CONTROLLER);

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
  return store;
}

describe("MicronautProcessor", () => {
  it("ignores Spring @Controller classes that implement API contracts", () => {
    const root = createTestTempDir("c2a-micronaut-spring-");
    const store = seedStore(root);
    const snapshot = store.snapshot();

    const micronautOutput = new MicronautProcessor().process(snapshot);
    assert.equal(micronautOutput.entities?.RestController?.length ?? 0, 0);
    assert.equal(micronautOutput.links?.HttpApiContractAssignment?.length ?? 0, 0);
  });

  it("does not duplicate HttpApiContractAssignment when combined with spring-webmvc", () => {
    const root = createTestTempDir("c2a-micronaut-spring-dup-");
    const store = seedStore(root);
    const snapshot = store.snapshot();

    const springOutput = new SpringWebMvcProcessor().process(snapshot);
    store.addCreateIntents(
      "scan.extract",
      { groupId: "scan.extract.rest.controllers", artifactId: "spring-webmvc" },
      springOutput,
    );

    const micronautOutput = new MicronautProcessor().process(store.snapshot());
    assert.doesNotThrow(() => {
      store.addCreateIntents(
        "scan.extract",
        { groupId: "scan.extract.rest.controllers", artifactId: "micronaut" },
        micronautOutput,
      );
    });
  });
});
