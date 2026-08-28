import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  GROUP_ENTITY_ALLOWLIST,
  RunEntityStore,
} from "../../src/discovery-model/run-entity-store.js";
import { packageVersion } from "../../src/package-version.js";

const SCAN_SCOPE_PROCESSOR = {
  groupId: "scan-scope" as const,
  artifactId: "test-processor",
};

const SCAN_TECH_PROCESSOR = {
  groupId: "scan-tech" as const,
  artifactId: "test-processor",
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
      "scan-scope",
      { groupId: "scan-scope", artifactId: "git-repos" },
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
    assert.equal(repository?.scannerExtractor, "scan-scope:git-repos");
    assert.equal(repository?.scannerSchema, packageVersion);
    assert.equal(repository?.extractedAt, "2026-08-28T12:49:00.123+03:00");
  });

  it("formats scanner extractor as groupId:artifactId", () => {
    const store = new RunEntityStore({
      sourceDirs: ["/tmp/src"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    store.addCreateIntents("scan-tech", { groupId: "scan-tech", artifactId: "maven-module" }, {
      entities: {
        BuildScript: [{ id: "bs-1" }],
      },
    });

    assert.equal(
      store.getEntities("BuildScript")[0]?.scannerExtractor,
      "scan-tech:maven-module",
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
        store.addCreateIntents("scan-scope", SCAN_SCOPE_PROCESSOR, {
          entities: {
            BuildScript: [{ id: "bs-1" }],
          },
        }),
      /not allowed for processor group scan-scope/,
    );
  });

  it("throws on duplicate id within the same entity type", () => {
    const store = new RunEntityStore({
      sourceDirs: ["/tmp/src"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    store.addCreateIntents("scan-scope", SCAN_SCOPE_PROCESSOR, {
      entities: {
        Repository: [{ id: "same-id", name: "a" }],
      },
    });

    assert.throws(
      () =>
        store.addCreateIntents("scan-scope", SCAN_SCOPE_PROCESSOR, {
          entities: {
            Repository: [{ id: "same-id", name: "b" }],
          },
        }),
      /Duplicate Repository id: same-id/,
    );
  });

  it("allows the same id across different entity types", () => {
    const store = new RunEntityStore({
      sourceDirs: ["/tmp/src"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    store.addCreateIntents("scan-scope", SCAN_SCOPE_PROCESSOR, {
      entities: {
        Repository: [{ id: "shared-id", name: "repo" }],
      },
    });
    store.addCreateIntents("scan-tech", SCAN_TECH_PROCESSOR, {
      entities: {
        BuildScript: [{ id: "shared-id", script: "build" }],
      },
    });

    assert.equal(store.getEntities("Repository")[0]?.id, "shared-id");
    assert.equal(store.getEntities("BuildScript")[0]?.id, "shared-id");
  });

  it("returns a deep-frozen snapshot", () => {
    const store = new RunEntityStore({
      sourceDirs: ["/tmp/src"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    store.addCreateIntents("scan-scope", SCAN_SCOPE_PROCESSOR, {
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

  it("mirrors group allowlist from specifications", () => {
    assert.deepEqual(GROUP_ENTITY_ALLOWLIST["scan-scope"], ["Repository"]);
    assert.deepEqual(GROUP_ENTITY_ALLOWLIST["scan-tech"], [
      "BuildScript",
      "RuntimeEnvironment",
    ]);
    assert.deepEqual(GROUP_ENTITY_ALLOWLIST["scan-app"], [
      "ApplicationModule",
      "ApplicationModuleDependency",
      "RestController",
      "RestClient",
      "MessageConsumer",
      "MessageProducer",
    ]);
  });
});
