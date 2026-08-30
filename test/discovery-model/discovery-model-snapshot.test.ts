import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDiscoveryModelSnapshot } from "../../src/discovery-model/discovery-model-snapshot.js";
import type { DiscoveryEntityRecord } from "../../src/discovery-model/entities/entity-types.js";

const RUN_STARTED_AT = new Date("2026-08-30T12:00:00.000Z");

function baseInit(
  entityArrays: Partial<Record<string, readonly DiscoveryEntityRecord[]>>,
) {
  return {
    scanId: "scan-1",
    sourceRoot: "/repo",
    runStartedAt: RUN_STARTED_AT,
    entityArrays: entityArrays as Partial<
      Record<
        import("../../src/discovery-model/entities/entity-types.js").EntityType,
        readonly DiscoveryEntityRecord[]
      >
    >,
  };
}

describe("buildDiscoveryModelSnapshot", () => {
  it("builds id and ref indexes from entity arrays", () => {
    const snapshot = buildDiscoveryModelSnapshot(
      baseInit({
        Repository: [{ id: "repo-1", name: "repo" }],
        ApplicationModule: [
          {
            id: "module-a",
            repositoryId: "repo-1",
            parentId: "module-root",
            name: "module-a",
          },
          {
            id: "module-b",
            repositoryId: "repo-1",
            name: "module-b",
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
          {
            id: "dep-2",
            parentId: "module-b",
            groupId: "com.example",
            artifactId: "other",
            version: "2.0.0",
          },
        ],
      }),
    );

    assert.equal(snapshot.getEntity("Repository", "repo-1")?.name, "repo");
    assert.equal(snapshot.getById("module-a")?.name, "module-a");
    assert.deepEqual(
      snapshot.listEntitiesByRef("ApplicationModule", "repositoryId", "repo-1").map((e) => e.id),
      ["module-a", "module-b"],
    );
    assert.deepEqual(
      snapshot
        .listEntitiesByRef("ApplicationModuleDependency", "parentId", "module-a")
        .map((e) => e.id),
      ["dep-1"],
    );
    assert.deepEqual(
      snapshot.listEntitiesByRef("ApplicationModule", "parentId", "module-root").map((e) => e.id),
      ["module-a"],
    );
  });

  it("builds indexes from entity maps", () => {
    const bucket = new Map<string, DiscoveryEntityRecord>([
      ["repo-1", { id: "repo-1", name: "repo" }],
    ]);

    const snapshot = buildDiscoveryModelSnapshot({
      scanId: "scan-1",
      sourceRoot: "/repo",
      runStartedAt: RUN_STARTED_AT,
      entityMaps: new Map([["Repository", bucket]]),
    });

    assert.equal(snapshot.listEntities("Repository").length, 1);
    assert.equal(snapshot.getEntity("Repository", "repo-1")?.name, "repo");
  });

  it("returns empty arrays for unknown ref fields and unindexed entity types", () => {
    const snapshot = buildDiscoveryModelSnapshot(
      baseInit({
        Repository: [{ id: "repo-1", name: "repo" }],
      }),
    );

    assert.deepEqual(snapshot.listEntitiesByRef("Repository", "name", "repo"), []);
    assert.deepEqual(
      snapshot.listEntitiesByRef("ApplicationModule", "repositoryId", "repo-1"),
      [],
    );
  });

  it("omits optional ref field values from the index", () => {
    const snapshot = buildDiscoveryModelSnapshot(
      baseInit({
        ApplicationModule: [
          {
            id: "module-root",
            repositoryId: "repo-1",
            name: "root",
          },
        ],
      }),
    );

    assert.deepEqual(snapshot.listEntitiesByRef("ApplicationModule", "parentId", "missing"), []);
  });

  it("returns a deep-frozen snapshot", () => {
    const snapshot = buildDiscoveryModelSnapshot(
      baseInit({
        Repository: [{ id: "repo-1", name: "repo" }],
      }),
    );

    assert.throws(() => {
      (snapshot as { scanId: string }).scanId = "mutated";
    });
  });

  it("requires entityMaps or entityArrays", () => {
    assert.throws(
      () =>
        buildDiscoveryModelSnapshot({
          scanId: "scan-1",
          sourceRoot: "/repo",
          runStartedAt: RUN_STARTED_AT,
        }),
      /requires entityMaps or entityArrays/,
    );
  });
});
