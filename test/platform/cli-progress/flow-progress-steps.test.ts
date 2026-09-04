import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCliProgressFlow } from "../../../src/platform/cli-progress/cli-progress-flow.js";
import {
  defineFlowSteps,
  processorGroupFlowStep,
  scopeDiscoveryFlowStep,
} from "../../../src/platform/cli-progress/flow-progress-steps.js";
import { noopStepHandle } from "../../../src/platform/cli-progress/noop-flow-progress.js";

describe("scopeDiscoveryFlowStep", () => {
  it("uses source dir count as initial total when scope processors exist", () => {
    assert.deepEqual(scopeDiscoveryFlowStep(3, 1), {
      id: "1",
      label: "Repository discovery",
      initialTotal: 3,
    });
  });

  it("returns undefined when scope processor count is zero", () => {
    assert.equal(scopeDiscoveryFlowStep(3, 0), undefined);
  });
});

describe("processorGroupFlowStep", () => {
  it("returns step definition when processor count is positive", () => {
    assert.deepEqual(processorGroupFlowStep("2", "Views generation", 3), {
      id: "2",
      label: "Views generation",
      initialTotal: 3,
    });
  });

  it("returns undefined when processor count is zero", () => {
    assert.equal(processorGroupFlowStep("2", "Views generation", 0), undefined);
  });
});

describe("defineFlowSteps", () => {
  it("omits undefined processor steps and keeps fixed steps", () => {
    assert.deepEqual(
      defineFlowSteps(
        processorGroupFlowStep("1", "Elements generation", 5),
        processorGroupFlowStep("2", "Views generation", 0),
        { id: "3", label: "Writing archimate-model", initialTotal: 1 },
      ),
      [
        { id: "1", label: "Elements generation", initialTotal: 5 },
        { id: "3", label: "Writing archimate-model", initialTotal: 1 },
      ],
    );
  });
});

describe("createCliProgressFlow optional steps", () => {
  it("returns noop handle for step ids that were not registered", () => {
    const originalIsTTY = process.stderr.isTTY;
    Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });

    try {
      const progress = createCliProgressFlow([
        { id: "1", label: "Elements generation", initialTotal: 1 },
      ]);

      assert.equal(progress.step("2"), noopStepHandle);
      progress.stop();
    } finally {
      Object.defineProperty(process.stderr, "isTTY", { value: originalIsTTY, configurable: true });
    }
  });
});
