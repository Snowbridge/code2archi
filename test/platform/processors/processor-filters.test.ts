import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GlobalArgv } from "../../../src/cli/processor-groups.js";
import type { IProcessor } from "../../../src/platform/processors/processor.js";
import { ProcessorRegistry } from "../../../src/platform/processors/processor-registry.js";
import { resolveProcessorFilters } from "../../../src/platform/processors/resolve-processor-filters.js";

class StubProcessor implements IProcessor<string, string[]> {
  constructor(readonly id: { groupId: "scan-scope"; artifactId: string }) {}

  readonly version = "0.0.0";

  process(): string[] {
    return [];
  }
}

function emptyGlobalArgv(overrides: Partial<GlobalArgv> = {}): GlobalArgv {
  return {
    logLevel: "INFO",
    verbose: false,
    profile: false,
    threads: 1,
    sync: false,
    continueOnError: false,
    withNone: [],
    withoutScanScope: [],
    withoutScanTech: [],
    withoutScanApp: [],
    withoutGenerateElement: [],
    withoutGenerateRelation: [],
    withoutGenerateView: [],
    withOnlyScanScope: [],
    withOnlyScanTech: [],
    withOnlyScanApp: [],
    withOnlyGenerateElement: [],
    withOnlyGenerateRelation: [],
    withOnlyGenerateView: [],
    ...overrides,
  };
}

describe("resolveProcessorFilters", () => {
  it("maps global argv to processor filters", () => {
    const filters = resolveProcessorFilters(
      emptyGlobalArgv({
        withNone: ["scan-app"],
        withoutScanScope: ["git-repos"],
        withOnlyScanTech: ["build-system-maven-single-module"],
      }),
    );

    assert.deepEqual(filters.withNone, ["scan-app"]);
    assert.deepEqual(filters.without["scan-scope"], ["git-repos"]);
    assert.deepEqual(filters.withOnly["scan-tech"], [
      "build-system-maven-single-module",
    ]);
  });
});

describe("ProcessorRegistry.listFiltered", () => {
  it("returns all processors when no filters apply", () => {
    const registry = new ProcessorRegistry();
    const alpha = new StubProcessor({ groupId: "scan-scope", artifactId: "alpha" });
    const beta = new StubProcessor({ groupId: "scan-scope", artifactId: "beta" });
    registry.register(alpha);
    registry.register(beta);

    const result = registry.listFiltered("scan-scope", {
      withNone: [],
      without: {},
      withOnly: {},
    });

    assert.deepEqual(result, [alpha, beta]);
  });

  it("returns empty list for with-none", () => {
    const registry = new ProcessorRegistry();
    registry.register(new StubProcessor({ groupId: "scan-scope", artifactId: "alpha" }));

    const result = registry.listFiltered("scan-scope", {
      withNone: ["scan-scope"],
      without: {},
      withOnly: {},
    });

    assert.deepEqual(result, []);
  });

  it("applies with-only filter", () => {
    const registry = new ProcessorRegistry();
    const alpha = new StubProcessor({ groupId: "scan-scope", artifactId: "alpha" });
    const beta = new StubProcessor({ groupId: "scan-scope", artifactId: "beta" });
    registry.register(alpha);
    registry.register(beta);

    const result = registry.listFiltered("scan-scope", {
      withNone: [],
      without: {},
      withOnly: { "scan-scope": ["beta"] },
    });

    assert.deepEqual(result, [beta]);
  });

  it("applies without filter", () => {
    const registry = new ProcessorRegistry();
    const alpha = new StubProcessor({ groupId: "scan-scope", artifactId: "alpha" });
    const beta = new StubProcessor({ groupId: "scan-scope", artifactId: "beta" });
    registry.register(alpha);
    registry.register(beta);

    const result = registry.listFiltered("scan-scope", {
      withNone: [],
      without: { "scan-scope": ["alpha"] },
      withOnly: {},
    });

    assert.deepEqual(result, [beta]);
  });
});
