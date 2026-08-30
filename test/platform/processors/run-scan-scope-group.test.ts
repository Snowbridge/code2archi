import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { RepositoryCreateIntent } from "../../../src/discovery-model/entities/repository.js";
import { RunEntityStore } from "../../../src/discovery-model/run-entity-store.js";
import {
  AbstractProcessor,
  type ScanScopeInput,
  type ScanScopeOutput,
} from "../../../src/platform/processors/processor.js";
import { processorRegistry } from "../../../src/platform/processors/processor-registry.js";
import { runScanScopeGroup } from "../../../src/platform/processors/run-scan-scope-group.js";

class StubRepositoryProcessor extends AbstractProcessor<ScanScopeInput, ScanScopeOutput> {
  readonly id: { groupId: "scan-scope"; artifactId: string };
  readonly version = "0.0.0";
  readonly executionPolicy = "ALWAYS" as const;
  readonly description = "Stub processor for tests.";

  constructor(
    id: { groupId: "scan-scope"; artifactId: string },
    private readonly repositories: RepositoryCreateIntent[],
  ) {
    super();
    this.id = id;
  }

  protected doProcess(): ScanScopeOutput {
    return this.repositories;
  }
}

const STUB_ONE = "test-stub-one";
const STUB_TWO = "test-stub-two";
const STUB_STORE = "test-stub-store";

describe("runScanScopeGroup", () => {
  after(() => {
    processorRegistry.unregister("scan-scope", STUB_ONE);
    processorRegistry.unregister("scan-scope", STUB_TWO);
    processorRegistry.unregister("scan-scope", STUB_STORE);
  });

  it("unions repositories by id and throws on duplicate id", () => {
    const repository: RepositoryCreateIntent = {
      id: "repo-1",
      name: "a",
      namespace: "/a",
      localPath: "/tmp/a",
      url: "",
      buildSystems: [],
    };

    processorRegistry.register(
      new StubRepositoryProcessor({ groupId: "scan-scope", artifactId: STUB_ONE }, [repository]),
    );
    processorRegistry.register(
      new StubRepositoryProcessor({ groupId: "scan-scope", artifactId: STUB_TWO }, [repository]),
    );

    const store = new RunEntityStore({
      sourceDirs: ["/tmp"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    assert.throws(
      () =>
        runScanScopeGroup(
          ["/tmp"],
          {
            withNone: [],
            without: {},
            with: {},
            withOnly: { "scan-scope": [STUB_ONE, STUB_TWO] },
          },
          store,
        ),
      /Duplicate id: repo-1/,
    );
  });

  it("stores merged repositories in run entity store with scannerExtractor", () => {
    const repository: RepositoryCreateIntent = {
      id: "repo-1",
      name: "a",
      namespace: "/a",
      localPath: "/tmp/a",
      url: "",
      buildSystems: [],
    };

    processorRegistry.register(
      new StubRepositoryProcessor({ groupId: "scan-scope", artifactId: STUB_STORE }, [repository]),
    );

    const store = new RunEntityStore({
      sourceDirs: ["/tmp"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    runScanScopeGroup(
      ["/tmp"],
      {
        withNone: [],
        without: {},
        with: {},
        withOnly: { "scan-scope": [STUB_STORE] },
      },
      store,
    );

    assert.equal(store.getEntities("Repository").length, 1);
    assert.equal(store.getEntities("Repository")[0]?.name, "a");
    assert.equal(
      store.getEntities("Repository")[0]?.scannerExtractor,
      `scan-scope:${STUB_STORE}`,
    );
  });
});
