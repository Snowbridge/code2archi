import assert from "node:assert/strict";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  GROUP_ENTITY_ALLOWLIST,
  GROUP_LINK_ALLOWLIST,
  RunEntityStore,
} from "../../src/discovery-model/run-entity-store.js";
import { DirectRestRequestsServingMatch } from "../../src/discovery-model/links/direct-rest-requests-serving-match.js";
import { packageVersion } from "../../src/package-version.js";
import { createTestTempDir } from "../test-temp-dir.js";

const SCAN_SCOPE_PROCESSOR = {
  groupId: "scan.scope",
  artifactId: "test-processor",
};

const SCAN_SOURCE_PROCESSOR = {
  groupId: "scan.source",
  artifactId: "test-processor",
};

const SCAN_LINK_PROCESSOR = {
  groupId: "scan.link.rest",
  artifactId: "direct-rest-requests-serving",
};

describe("RunEntityStore", () => {
  const previousTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Etc/GMT-3";
  });

  afterEach(() => {
    if (previousTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTz;
    }
  });

  it("adds entities allowed for the processor group with platform metadata", () => {
    const store = new RunEntityStore({
      sourceDirs: ["/tmp/src"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    const extractedAt = new Date("2026-08-28T09:49:00.123Z");
    store.addCreateIntents(
      "scan.scope",
      { groupId: "scan.scope", artifactId: "git-repositories" },
      {
        entities: {
          Repository: [{ id: "repo-1", name: "a" }],
        },
      },
      extractedAt,
    );

    const repository = store.getEntities("Repository")[0];
    assert.equal(store.getEntities("Repository").length, 1);
    assert.equal(repository?.name, "a");
    assert.equal(repository?.scannerExtractor, "scan.scope:git-repositories");
    assert.equal(repository?.scannerSchema, packageVersion);
    assert.equal(repository?.extractedAt, "2026-08-28T12:49:00.123+03:00");
  });

  it("formats scanner extractor as groupId:artifactId", () => {
    const store = new RunEntityStore({
      sourceDirs: ["/tmp/src"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    store.addCreateIntents("scan.source", { groupId: "scan.source", artifactId: "maven-module" }, {
      entities: {
        BuildScript: [{ id: "bs-1" }],
      },
    });

    assert.equal(
      store.getEntities("BuildScript")[0]?.scannerExtractor,
      "scan.source:maven-module",
    );
  });

  it("rejects entity types not allowed for the processor group", () => {
    const store = new RunEntityStore({
      sourceDirs: ["/tmp/src"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    assert.throws(
      () =>
        store.addCreateIntents("scan.scope", SCAN_SCOPE_PROCESSOR, {
          entities: {
            BuildScript: [{ id: "bs-1" }],
          },
        }),
      /not allowed for processor group scan\.scope/,
    );
  });

  it("throws on duplicate id within the same entity type", () => {
    const store = new RunEntityStore({
      sourceDirs: ["/tmp/src"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    store.addCreateIntents("scan.scope", SCAN_SCOPE_PROCESSOR, {
      entities: {
        Repository: [{ id: "same-id", name: "a" }],
      },
    });

    assert.throws(
      () =>
        store.addCreateIntents("scan.scope", SCAN_SCOPE_PROCESSOR, {
          entities: {
            Repository: [{ id: "same-id", name: "b" }],
          },
        }),
      /Duplicate id: same-id/,
    );
  });

  it("throws on duplicate id across different entity types", () => {
    const store = new RunEntityStore({
      sourceDirs: ["/tmp/src"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    store.addCreateIntents("scan.scope", SCAN_SCOPE_PROCESSOR, {
      entities: {
        Repository: [{ id: "shared-id", name: "repo" }],
      },
    });

    assert.throws(
      () =>
        store.addCreateIntents("scan.source", SCAN_SOURCE_PROCESSOR, {
          entities: {
            BuildScript: [{ id: "shared-id", script: "build" }],
          },
        }),
      /Duplicate id: shared-id/,
    );
  });

  it("returns a deep-frozen snapshot", () => {
    const store = new RunEntityStore({
      sourceDirs: ["/tmp/src"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    store.addCreateIntents("scan.scope", SCAN_SCOPE_PROCESSOR, {
      entities: {
        Repository: [{ id: "repo-1", name: "a" }],
      },
    });

    const snapshot = store.snapshot();
    assert.equal(snapshot.scanId, "scan-1");
    assert.equal(snapshot.listEntities("Repository").length, 1);

    assert.throws(() => {
      (snapshot as { scanId: string }).scanId = "mutated";
    });
  });

  it("exposes indexed lookup helpers on snapshot", () => {
    const store = new RunEntityStore({
      sourceDirs: ["/tmp/src"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    store.addCreateIntents("scan.scope", SCAN_SCOPE_PROCESSOR, {
      entities: {
        Repository: [{ id: "repo-1", name: "repo" }],
      },
    });
    store.addCreateIntents("scan.source", SCAN_SOURCE_PROCESSOR, {
      entities: {
        ApplicationModule: [
          {
            id: "module-a",
            repositoryId: "repo-1",
            name: "module-a",
          },
        ],
        ApplicationModuleDependency: [
          {
            id: "dep-1",
            parentId: "module-a",
            groupId: "com.example",
            artifactId: "lib",
            version: "1.0.0",
          },
        ],
      },
    });

    const snapshot = store.snapshot();

    assert.equal(snapshot.getById("module-a")?.name, "module-a");
    assert.equal(snapshot.getEntity("ApplicationModule", "module-a")?.repositoryId, "repo-1");
    assert.deepEqual(
      snapshot.listEntitiesByRef("ApplicationModuleDependency", "parentId", "module-a").map(
        (entity) => entity.id,
      ),
      ["dep-1"],
    );
    assert.deepEqual(
      snapshot.listEntitiesByRef("ApplicationModule", "repositoryId", "repo-1").map(
        (entity) => entity.id,
      ),
      ["module-a"],
    );
    assert.deepEqual(snapshot.listEntitiesByRef("Repository", "name", "repo"), []);
  });

  it("finalizes repository namespaces from common root of discovered repos", () => {
    const root = createTestTempDir("c2a-store-ns-");
    const repoOne = path.join(root, "fizz", "fuzz", "bar", "buzz", "repo-one");
    const repoTwo = path.join(root, "fizz", "other", "branch", "repo-two");
    const store = new RunEntityStore({
      sourceDirs: [root],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    store.addCreateIntents("scan.scope", SCAN_SCOPE_PROCESSOR, {
      entities: {
        Repository: [
          {
            id: "repo-1",
            name: "repo-one",
            namespace: "",
            localPath: repoOne,
            url: "",
            buildSystems: ["maven"],
          },
          {
            id: "repo-2",
            name: "repo-two",
            namespace: "",
            localPath: repoTwo,
            url: "",
            buildSystems: ["maven"],
          },
        ],
      },
    });

    const commonRoot = store.finalizeRepositoryNamespaces();
    const snapshot = store.snapshot();

    assert.equal(commonRoot, path.join(root, "fizz"));
    assert.equal(snapshot.repositoryCommonRoot, path.join(root, "fizz"));
    assert.deepEqual(snapshot.sourceDirs, [path.resolve(root)]);
    assert.equal(
      snapshot.getEntity("Repository", "repo-1")?.namespace,
      "fuzz/bar/buzz",
    );
    assert.equal(
      snapshot.getEntity("Repository", "repo-2")?.namespace,
      "other/branch",
    );
  });

  it("mirrors group allowlist from specifications", () => {
    assert.deepEqual(GROUP_ENTITY_ALLOWLIST["scan.scope"], ["Repository"]);
    assert.deepEqual(GROUP_ENTITY_ALLOWLIST["scan.source"], [
      "BuildScript",
      "RuntimeEnvironment",
      "ApplicationModule",
      "ApplicationModuleDependency",
      "RestController",
      "RestClient",
      "NodejsRestController",
      "NodejsRestClient",
      "MessageConsumer",
      "MessageProducer",
    ]);
    assert.deepEqual(GROUP_LINK_ALLOWLIST["scan.link"], [
      "DirectRestRequestsServingMatch",
      "NodejsDirectRestRequestsServingMatch",
    ]);
  });

  it("adds links allowed for scan.link with platform metadata", () => {
    const store = new RunEntityStore({
      sourceDirs: ["/tmp/src"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    const link = new DirectRestRequestsServingMatch({
      restControllerId: "ctrl-1",
      restClientId: "client-1",
      sourceApplicationModuleId: "mod-server",
      targetApplicationModuleId: "mod-client",
      matchMethod: "INTERFACE",
      confidence: "confirmed",
      confidenceScore: 1,
    });

    store.addCreateIntents("scan.link", SCAN_LINK_PROCESSOR, {
      links: {
        DirectRestRequestsServingMatch: [link],
      },
    });

    const stored = store.getLinks("DirectRestRequestsServingMatch")[0];
    assert.equal(stored?.matchMethod, "INTERFACE");
    assert.equal(stored?.linkerExtractor, "scan.link.rest:direct-rest-requests-serving");
    assert.equal(stored?.linkerSchema, packageVersion);

    const snapshot = store.snapshot();
    assert.equal(snapshot.listLinks("DirectRestRequestsServingMatch").length, 1);
    assert.deepEqual(
      snapshot.listLinksByRef(
        "DirectRestRequestsServingMatch",
        "sourceApplicationModuleId",
        "mod-server",
      ).map((record) => record.id),
      [stored?.id],
    );
  });
});
