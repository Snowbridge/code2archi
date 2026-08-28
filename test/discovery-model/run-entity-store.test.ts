import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RunEntityStore } from "../../src/discovery-model/run-entity-store.js";
import { groupEntityAllowlistForTests } from "../../src/discovery-model/group-entity-allowlist.js";

describe("RunEntityStore", () => {
  it("adds entities allowed for the processor group", () => {
    const store = new RunEntityStore({
      sourceDirs: ["/tmp/src"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    store.addCreateIntents("scan-scope", {
      entities: {
        Repository: [{ id: "repo-1", name: "a" }],
      },
    });

    assert.equal(store.getEntities("Repository").length, 1);
    assert.equal(store.getEntities("Repository")[0]?.name, "a");
  });

  it("rejects entity types not allowed for the processor group", () => {
    const store = new RunEntityStore({
      sourceDirs: ["/tmp/src"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    assert.throws(
      () =>
        store.addCreateIntents("scan-scope", {
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

    store.addCreateIntents("scan-scope", {
      entities: {
        Repository: [{ id: "same-id", name: "a" }],
      },
    });

    assert.throws(
      () =>
        store.addCreateIntents("scan-scope", {
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

    store.addCreateIntents("scan-scope", {
      entities: {
        Repository: [{ id: "shared-id", name: "repo" }],
      },
    });
    store.addCreateIntents("scan-tech", {
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

    store.addCreateIntents("scan-scope", {
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
    assert.deepEqual(groupEntityAllowlistForTests()["scan-scope"], ["Repository"]);
    assert.deepEqual(groupEntityAllowlistForTests()["scan-tech"], [
      "BuildScript",
      "RuntimeEnvironment",
    ]);
  });
});
