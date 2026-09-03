import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "../../src/platform/processors/builtin-processors.js";
import { AbstractProcessor } from "../../src/platform/processors/processor.js";
import { ProcessorRegistry } from "../../src/platform/processors/processor-registry.js";
import {
  filterProcessorsByGroupPatterns,
  listDistinctGroupIds,
} from "../../src/list/filter-processors-by-group-patterns.js";

class StubProcessor extends AbstractProcessor<string, string[]> {
  readonly id: { groupId: string; artifactId: string };
  readonly version = "1.0.0";
  readonly executionPolicy = "ALWAYS" as const;
  readonly description = "Stub processor for tests.";

  constructor(id: { groupId: string; artifactId: string }) {
    super();
    this.id = id;
  }

  protected doProcess(): string[] {
    return [];
  }
}

describe("filterProcessorsByGroupPatterns", () => {
  it("returns all builtin processors sorted when patterns are empty", () => {
    const processors = filterProcessorsByGroupPatterns([]);
    assert.ok(processors.length >= 20);

    for (let index = 1; index < processors.length; index += 1) {
      const previous = processors[index - 1]!;
      const current = processors[index]!;
      const groupCompare = previous.id.groupId.localeCompare(current.id.groupId);
      assert.ok(
        groupCompare < 0 ||
          (groupCompare === 0 &&
            previous.id.artifactId.localeCompare(current.id.artifactId) <= 0),
      );
    }
  });

  it("filters by wildcard OR exact groupId literal", () => {
    const processors = filterProcessorsByGroupPatterns([
      "generate.elements.application",
      "scan.scope.*",
    ]);

    assert.ok(processors.length > 0);
    assert.ok(
      processors.every(
        (processor) =>
          processor.id.groupId === "generate.elements.application" ||
          processor.id.groupId === "scan.scope" ||
          processor.id.groupId.startsWith("scan.scope."),
      ),
    );
  });

  it("returns empty list for unknown group pattern", () => {
    assert.deepEqual(filterProcessorsByGroupPatterns(["nonexistent.group"]), []);
  });

  it("lists distinct group ids in sorted order", () => {
    const registry = new ProcessorRegistry();
    registry.register(new StubProcessor({ groupId: "scan.scope", artifactId: "b" }));
    registry.register(new StubProcessor({ groupId: "scan.scope", artifactId: "a" }));
    registry.register(
      new StubProcessor({ groupId: "scan.source.rest.controller.java", artifactId: "x" }),
    );

    const processors = registry.listAll();
    assert.deepEqual(listDistinctGroupIds(processors), [
      "scan.scope",
      "scan.source.rest.controller.java",
    ]);
  });
});
