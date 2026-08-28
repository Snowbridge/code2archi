import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { Repository } from "../../../src/discovery-model/repository.js";
import type { IProcessor } from "../../../src/platform/processors/processor.js";
import { processorRegistry } from "../../../src/platform/processors/processor-registry.js";
import { runScanScopeGroup } from "../../../src/platform/processors/run-scan-scope-group.js";
import type { ScanScopeInput, ScanScopeOutput } from "../../../src/platform/processors/scan-scope-types.js";

class StubRepositoryProcessor implements IProcessor<ScanScopeInput, ScanScopeOutput> {
  constructor(
    readonly id: { groupId: "scan-scope"; artifactId: string },
    private readonly repositories: Repository[],
  ) {}

  readonly version = "0.0.0";

  readonly executionPolicy = "ALWAYS" as const;

  process(): ScanScopeOutput {
    return this.repositories;
  }
}

const STUB_ONE = "test-stub-one";
const STUB_TWO = "test-stub-two";

describe("runScanScopeGroup", () => {
  after(() => {
    processorRegistry.unregister("scan-scope", STUB_ONE);
    processorRegistry.unregister("scan-scope", STUB_TWO);
  });

  it("unions repositories by id and throws on duplicate id", () => {
    const repository: Repository = {
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

    assert.throws(
      () =>
        runScanScopeGroup(["/tmp"], {
          withNone: [],
          without: {},
          with: {},
          withOnly: { "scan-scope": [STUB_ONE, STUB_TWO] },
        }),
      /Duplicate repository id: repo-1/,
    );
  });
});
