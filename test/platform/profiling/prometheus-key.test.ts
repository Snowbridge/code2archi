import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMetricKey } from "../../../src/platform/profiling/prometheus-key.js";

describe("formatMetricKey", () => {
  it("returns bare metric id without labels", () => {
    assert.equal(formatMetricKey("run.duration.total", undefined, []), "run.duration.total");
  });

  it("serializes labels in alphabetical order", () => {
    assert.equal(
      formatMetricKey(
        "run.processor.duration.avg",
        ["groupId", "artifactId"],
        ["scan.source", "annotation-based"],
      ),
      'run.processor.duration.avg{artifactId="annotation-based",groupId="scan.source"}',
    );
  });

  it("escapes special characters in label values", () => {
    assert.equal(
      formatMetricKey("run.files.processed", ["ext"], ['.java"quote']),
      'run.files.processed{ext=".java\\"quote"}',
    );
  });
});
