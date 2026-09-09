import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { RepositoryCreateIntent } from "../../../src/code-inventory/entities/repository.js";
import { RunEntityStore } from "../../../src/code-inventory/run-entity-store.js";
import {
  AbstractProcessor,
  type ScanScopeInput,
  type ScanScopeOutput,
} from "../../../src/platform/processors/processor.js";
import { processorRegistry } from "../../../src/platform/processors/processor-registry.js";
import { runScanScopeGroup } from "../../../src/platform/processors/run-scan-scope-group.js";
import type { ProcessorSupplementRef } from "../../../src/platform/processors/processor-supplements.js";
import { resolveProcessorSupplementCatalog, supplementToken } from "../../../src/platform/processors/processor-supplements.js";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createTestTempDir } from "../../test-temp-dir.js";

class StubRepositoryProcessor extends AbstractProcessor<ScanScopeInput, ScanScopeOutput> {
  readonly id: { groupId: string; artifactId: string };
  readonly version = "0.0.0";
  readonly executionPolicy = "ALWAYS" as const;
  readonly description = "Stub processor for tests.";

  constructor(
    id: { groupId: string; artifactId: string },
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
const STUB_SUPPLEMENT = "test-stub-supplement";

let capturedSupplements: readonly ProcessorSupplementRef[] = [];

class SupplementCapturingProcessor extends AbstractProcessor<ScanScopeInput, ScanScopeOutput> {
  readonly id = { groupId: "scan.scope", artifactId: STUB_SUPPLEMENT };
  readonly version = "0.0.0";
  readonly executionPolicy = "ALWAYS" as const;
  readonly description = "Captures supplements for tests.";

  protected doProcess(input: ScanScopeInput): ScanScopeOutput {
    capturedSupplements = input.supplements ?? [];
    return [];
  }
}

describe("runScanScopeGroup", () => {
  after(() => {
    processorRegistry.unregister("scan.scope", STUB_ONE);
    processorRegistry.unregister("scan.scope", STUB_TWO);
    processorRegistry.unregister("scan.scope", STUB_STORE);
    processorRegistry.unregister("scan.scope", STUB_SUPPLEMENT);
  });

  it("unions repositories by id and throws on duplicate id", async () => {
    const repository: RepositoryCreateIntent = {
      id: "repo-1",
      name: "a",
      namespace: "/a",
      localPath: "/tmp/a",
      url: "",
      buildSystems: [],
    };

    processorRegistry.register(
      new StubRepositoryProcessor({ groupId: "scan.scope", artifactId: STUB_ONE }, [repository]),
    );
    processorRegistry.register(
      new StubRepositoryProcessor({ groupId: "scan.scope", artifactId: STUB_TWO }, [repository]),
    );

    const store = new RunEntityStore({
      sourceDirs: ["/tmp"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    await assert.rejects(
      async () => {
        await runScanScopeGroup(
          ["/tmp"],
          {
            with: [],
            without: [],
            withOnly: [`scan.scope.${STUB_ONE}`, `scan.scope.${STUB_TWO}`],
          },
          store,
        );
      },
      /Duplicate id: repo-1/,
    );
  });

  it("stores merged repositories in run entity store with extractProcessor", async () => {
    const repository: RepositoryCreateIntent = {
      id: "repo-1",
      name: "a",
      namespace: "/a",
      localPath: "/tmp/a",
      url: "",
      buildSystems: [],
    };

    processorRegistry.register(
      new StubRepositoryProcessor({ groupId: "scan.scope", artifactId: STUB_STORE }, [repository]),
    );

    const store = new RunEntityStore({
      sourceDirs: ["/tmp"],
      scanId: "scan-1",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    });

    await runScanScopeGroup(
      ["/tmp"],
      {
        with: [],
        without: [],
        withOnly: [`scan.scope.${STUB_STORE}`],
      },
      store,
    );

    assert.equal(store.getEntities("Repository").length, 1);
    assert.equal(store.getEntities("Repository")[0]?.name, "a");
    assert.equal(
      store.getEntities("Repository")[0]?.extractProcessor,
      `scan.scope:${STUB_STORE}`,
    );
  });

  it("passes filtered supplements to sequential processors", async () => {
    const root = createTestTempDir("c2a-scope-supplements-");
    const hintsPath = path.join(root, "hints.txt");
    writeFileSync(hintsPath, "hint", "utf8");

    processorRegistry.register(new SupplementCapturingProcessor());
    capturedSupplements = [];

    const catalog = resolveProcessorSupplementCatalog(
      [supplementToken(`scan.scope.${STUB_SUPPLEMENT}`, hintsPath)],
      root,
    );

    await runScanScopeGroup(
      ["/tmp"],
      {
        with: [],
        without: [],
        withOnly: [`scan.scope.${STUB_SUPPLEMENT}`],
      },
      new RunEntityStore({
        sourceDirs: ["/tmp"],
        scanId: "scan-1",
        runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
      }),
      undefined,
      undefined,
      catalog,
    );

    assert.equal(capturedSupplements.length, 1);
    assert.equal(capturedSupplements[0]?.path, hintsPath);
    assert.equal(capturedSupplements[0]?.basename, "hints.txt");
  });
});
