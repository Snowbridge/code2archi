import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Profiler } from "../../../src/platform/profiling/profiler.js";

describe("Profiler", () => {
  it("registers metrics uniquely", () => {
    const profiler = new Profiler();
    profiler.registerMetric("custom.counter", "counter");
    assert.throws(() => profiler.registerMetric("custom.counter", "counter"), /already registered/);
  });

  it("aggregates counter, average, max, and min", () => {
    const profiler = new Profiler();
    profiler.registerMetric("hits", "counter");
    profiler.registerMetric("latency.avg", "average");
    profiler.registerMetric("latency.max", "max");
    profiler.registerMetric("latency.min", "min");

    profiler.recordValue("hits", 2);
    profiler.recordValue("hits", 3);
    profiler.recordValue("latency.avg", 10, ["a"]);
    profiler.recordValue("latency.avg", 20, ["a"]);
    profiler.recordValue("latency.max", 5, ["a"]);
    profiler.recordValue("latency.max", 9, ["a"]);
    profiler.recordValue("latency.min", 5, ["a"]);
    profiler.recordValue("latency.min", 9, ["a"]);

    assert.equal(profiler.getValue("hits"), 5);
    assert.equal(profiler.getValue("latency.avg", ["a"]), 15);
    assert.equal(profiler.getValue("latency.max", ["a"]), 9);
    assert.equal(profiler.getValue("latency.min", ["a"]), 5);
    assert.equal(profiler.getValue("missing"), undefined);
    assert.equal(profiler.getValue("latency.avg", ["missing"]), undefined);
  });

  it("throws when recording unknown metric", () => {
    const profiler = new Profiler();
    assert.throws(() => profiler.recordValue("unknown", 1), /not registered/);
  });
});
