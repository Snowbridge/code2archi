import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GlobalArgv } from "../../../src/cli/processor-groups.js";
import {
  AbstractProcessor,
  type ProcessorExecutionPolicy,
} from "../../../src/platform/processors/processor.js";
import {
  ProcessorRegistry,
  resolveProcessorFilters,
} from "../../../src/platform/processors/processor-registry.js";

class StubProcessor extends AbstractProcessor<string, string[]> {
  readonly id: { groupId: string; artifactId: string };
  readonly version = "0.0.0";
  readonly executionPolicy: ProcessorExecutionPolicy;
  readonly description = "Stub processor for tests.";

  constructor(
    id: { groupId: string; artifactId: string },
    executionPolicy: ProcessorExecutionPolicy = "ALWAYS",
  ) {
    super();
    this.id = id;
    this.executionPolicy = executionPolicy;
  }

  protected doProcess(): string[] {
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
    with: [],
    without: [],
    withOnly: [],
    ...overrides,
  };
}

function emptyFilters(
  overrides: Partial<ReturnType<typeof resolveProcessorFilters>> = {},
) {
  return {
    with: [],
    without: [],
    withOnly: [],
    ...overrides,
  };
}

describe("resolveProcessorFilters", () => {
  it("maps global argv to processor filters", () => {
    const filters = resolveProcessorFilters(
      emptyGlobalArgv({
        without: ["scan.scope.git-repositories"],
        with: ["scan.scope.unversioned-folders"],
        withOnly: ["scan.source.assembly.maven.modules-and-dependencies"],
      }),
    );

    assert.deepEqual(filters.without, ["scan.scope.git-repositories"]);
    assert.deepEqual(filters.with, ["scan.scope.unversioned-folders"]);
    assert.deepEqual(filters.withOnly, ["scan.source.assembly.maven.modules-and-dependencies"]);
  });
});

describe("ProcessorRegistry.listForBuiltInStep", () => {
  it("returns ALWAYS processors by default and excludes ON_DEMAND", () => {
    const registry = new ProcessorRegistry();
    const always = new StubProcessor({ groupId: "scan.scope", artifactId: "alpha" });
    const onDemand = new StubProcessor(
      { groupId: "scan.scope", artifactId: "beta" },
      "ON_DEMAND",
    );
    registry.register(always);
    registry.register(onDemand);

    const result = registry.listForBuiltInStep("scan.scope", emptyFilters());

    assert.deepEqual(result, [always]);
  });

  it("includes custom subgroup processors for built-in step", () => {
    const registry = new ProcessorRegistry();
    const builtIn = new StubProcessor({ groupId: "scan.source", artifactId: "alpha" });
    const custom = new StubProcessor({ groupId: "scan.source.assembly.maven", artifactId: "beta" });
    registry.register(builtIn);
    registry.register(custom);

    const result = registry.listForBuiltInStep("scan.source", emptyFilters());

    assert.deepEqual(result, [builtIn, custom]);
  });

  it("applies global with-only filter", () => {
    const registry = new ProcessorRegistry();
    const scope = new StubProcessor({ groupId: "scan.scope", artifactId: "alpha" });
    const source = new StubProcessor({ groupId: "scan.source", artifactId: "beta" });
    registry.register(scope);
    registry.register(source);

    const result = registry.listForBuiltInStep(
      "scan.scope",
      emptyFilters({ withOnly: ["scan.scope.alpha"] }),
    );

    assert.deepEqual(result, [scope]);
  });

  it("applies wildcard without filter", () => {
    const registry = new ProcessorRegistry();
    const alpha = new StubProcessor({ groupId: "scan.source", artifactId: "alpha" });
    const beta = new StubProcessor({ groupId: "scan.source", artifactId: "beta" });
    registry.register(alpha);
    registry.register(beta);

    const result = registry.listForBuiltInStep(
      "scan.source",
      emptyFilters({ without: ["scan.source.*"] }),
    );

    assert.deepEqual(result, []);
  });

  it("enables ON_DEMAND processors via with filter", () => {
    const registry = new ProcessorRegistry();
    const always = new StubProcessor({ groupId: "scan.scope", artifactId: "alpha" });
    const onDemand = new StubProcessor(
      { groupId: "scan.scope", artifactId: "beta" },
      "ON_DEMAND",
    );
    registry.register(always);
    registry.register(onDemand);

    const result = registry.listForBuiltInStep(
      "scan.scope",
      emptyFilters({ with: ["scan.scope.beta"] }),
    );

    assert.deepEqual(result, [always, onDemand]);
  });

  it("includes processors that share artifactId under different subgroup groupIds", () => {
    const registry = new ProcessorRegistry();
    const java = new StubProcessor({
      groupId: "scan.source.java.rest",
      artifactId: "controller-annotation-based",
    });
    const kotlin = new StubProcessor({
      groupId: "scan.source.kotlin.rest",
      artifactId: "controller-annotation-based",
    });
    registry.register(java);
    registry.register(kotlin);

    const result = registry.listForBuiltInStep("scan.source", emptyFilters());

    assert.deepEqual(result, [java, kotlin]);
  });

  it("rejects invalid groupId on register", () => {
    const registry = new ProcessorRegistry();
  const invalid = new StubProcessor({ groupId: "invalid.group", artifactId: "alpha" });

    assert.throws(
      () => registry.register(invalid),
      /Invalid processor groupId/,
    );
  });
});
