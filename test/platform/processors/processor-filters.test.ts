import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GlobalArgv } from "../../../src/cli/processor-groups.js";
import type {
  IProcessor,
  ProcessorExecutionPolicy,
} from "../../../src/platform/processors/processor.js";
import { ProcessorRegistry } from "../../../src/platform/processors/processor-registry.js";
import { resolveProcessorFilters } from "../../../src/platform/processors/resolve-processor-filters.js";

class StubProcessor implements IProcessor<string, string[]> {
  constructor(
    readonly id: { groupId: "scan-scope"; artifactId: string },
    readonly executionPolicy: ProcessorExecutionPolicy = "ALWAYS",
  ) {}

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
    withScanScope: [],
    withScanTech: [],
    withScanApp: [],
    withGenerateElement: [],
    withGenerateRelation: [],
    withGenerateView: [],
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

function emptyFilters(
  overrides: Partial<ReturnType<typeof resolveProcessorFilters>> = {},
) {
  return {
    withNone: [],
    without: {},
    with: {},
    withOnly: {},
    ...overrides,
  };
}

describe("resolveProcessorFilters", () => {
  it("maps global argv to processor filters", () => {
    const filters = resolveProcessorFilters(
      emptyGlobalArgv({
        withNone: ["scan-app"],
        withoutScanScope: ["git-repos"],
        withScanScope: ["unversioned-folders"],
        withOnlyScanTech: ["build-system-maven-single-module"],
      }),
    );

    assert.deepEqual(filters.withNone, ["scan-app"]);
    assert.deepEqual(filters.without["scan-scope"], ["git-repos"]);
    assert.deepEqual(filters.with["scan-scope"], ["unversioned-folders"]);
    assert.deepEqual(filters.withOnly["scan-tech"], [
      "build-system-maven-single-module",
    ]);
  });
});

describe("ProcessorRegistry.listFiltered", () => {
  it("returns ALWAYS processors by default and excludes ON_DEMAND", () => {
    const registry = new ProcessorRegistry();
    const always = new StubProcessor({ groupId: "scan-scope", artifactId: "alpha" });
    const onDemand = new StubProcessor(
      { groupId: "scan-scope", artifactId: "beta" },
      "ON_DEMAND",
    );
    registry.register(always);
    registry.register(onDemand);

    const result = registry.listFiltered("scan-scope", emptyFilters());

    assert.deepEqual(result, [always]);
  });

  it("returns empty list for with-none", () => {
    const registry = new ProcessorRegistry();
    registry.register(new StubProcessor({ groupId: "scan-scope", artifactId: "alpha" }));

    const result = registry.listFiltered(
      "scan-scope",
      emptyFilters({ withNone: ["scan-scope"] }),
    );

    assert.deepEqual(result, []);
  });

  it("applies with-only filter for ALWAYS and ON_DEMAND", () => {
    const registry = new ProcessorRegistry();
    const always = new StubProcessor({ groupId: "scan-scope", artifactId: "alpha" });
    const onDemand = new StubProcessor(
      { groupId: "scan-scope", artifactId: "beta" },
      "ON_DEMAND",
    );
    registry.register(always);
    registry.register(onDemand);

    const result = registry.listFiltered(
      "scan-scope",
      emptyFilters({ withOnly: { "scan-scope": ["beta"] } }),
    );

    assert.deepEqual(result, [onDemand]);
  });

  it("enables ON_DEMAND processors via with filter alongside ALWAYS", () => {
    const registry = new ProcessorRegistry();
    const always = new StubProcessor({ groupId: "scan-scope", artifactId: "alpha" });
    const onDemand = new StubProcessor(
      { groupId: "scan-scope", artifactId: "beta" },
      "ON_DEMAND",
    );
    registry.register(always);
    registry.register(onDemand);

    const result = registry.listFiltered(
      "scan-scope",
      emptyFilters({ with: { "scan-scope": ["beta"] } }),
    );

    assert.deepEqual(result, [always, onDemand]);
  });

  it("applies without filter to ALWAYS processors", () => {
    const registry = new ProcessorRegistry();
    const alpha = new StubProcessor({ groupId: "scan-scope", artifactId: "alpha" });
    const beta = new StubProcessor({ groupId: "scan-scope", artifactId: "beta" });
    registry.register(alpha);
    registry.register(beta);

    const result = registry.listFiltered(
      "scan-scope",
      emptyFilters({ without: { "scan-scope": ["alpha"] } }),
    );

    assert.deepEqual(result, [beta]);
  });
});
