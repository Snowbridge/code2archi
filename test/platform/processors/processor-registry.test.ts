import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AbstractProcessor } from "../../../src/platform/processors/processor.js";
import { ProcessorRegistry } from "../../../src/platform/processors/processor-registry.js";

class StubProcessor extends AbstractProcessor<string, string[]> {
  readonly id: { groupId: string; artifactId: string };
  readonly version = "0.0.0";
  readonly executionPolicy = "ALWAYS" as const;
  readonly description = "Stub processor for tests.";

  constructor(id: { groupId: string; artifactId: string }, private readonly output: string[] = []) {
    super();
    this.id = id;
  }

  protected doProcess(): string[] {
    return this.output;
  }
}

describe("ProcessorRegistry", () => {
  it("registers and retrieves processors", () => {
    const registry = new ProcessorRegistry();
    const processor = new StubProcessor({ groupId: "scan.scope", artifactId: "alpha" });

    registry.register(processor);

    assert.equal(registry.get("scan.scope", "alpha"), processor);
  });

  it("lists processors for built-in step in registration order", () => {
    const registry = new ProcessorRegistry();
    const first = new StubProcessor({ groupId: "scan.scope", artifactId: "first" });
    const second = new StubProcessor({ groupId: "scan.scope", artifactId: "second" });

    registry.register(first);
    registry.register(second);

    assert.deepEqual(registry.listForBuiltInStep("scan.scope", { with: [], without: [], withOnly: [] }), [
      first,
      second,
    ]);
  });

  it("rejects duplicate registration", () => {
    const registry = new ProcessorRegistry();
    const processor = new StubProcessor({ groupId: "scan.scope", artifactId: "dup" });

    registry.register(processor);

    assert.throws(
      () => registry.register(processor),
      /Processor already registered: scan\.scope\/dup/,
    );
  });

  it("unregisters processors", () => {
    const registry = new ProcessorRegistry();
    const processor = new StubProcessor({ groupId: "scan.scope", artifactId: "temp" });

    registry.register(processor);
    registry.unregister("scan.scope", "temp");

    assert.equal(registry.get("scan.scope", "temp"), undefined);
    assert.deepEqual(registry.listForBuiltInStep("scan.scope", { with: [], without: [], withOnly: [] }), []);
  });

  it("ignores unregister for missing processor", () => {
    const registry = new ProcessorRegistry();

    assert.doesNotThrow(() => registry.unregister("scan.scope", "missing"));
  });
});
