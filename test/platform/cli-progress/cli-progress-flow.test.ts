import assert from "node:assert/strict";
import { MultiBar } from "cli-progress";
import { describe, it } from "node:test";
import { createCliProgressFlow } from "../../../src/platform/cli-progress/cli-progress-flow.js";
import { createFlowProgress } from "../../../src/platform/cli-progress/create-flow-progress.js";
import { forEachRepository } from "../../../src/platform/cli-progress/for-each-repository.js";
import { noopFlowProgress } from "../../../src/platform/cli-progress/noop-flow-progress.js";
import type { StepProgressHandle } from "../../../src/platform/cli-progress/types.js";
import { RunEntityStore } from "../../../src/discovery-model/run-entity-store.js";
import { Repository } from "../../../src/discovery-model/entities/repository.js";
import type { ScanAppInput } from "../../../src/platform/processors/processor.js";

describe("createFlowProgress", () => {
  it("returns noop when verbose is true", () => {
    const progress = createFlowProgress({
      verbose: true,
      steps: [{ id: "1", label: "Step", initialTotal: 1 }],
    });
    assert.equal(progress, noopFlowProgress);
  });

  it("returns noop when stderr is not a TTY", () => {
    const originalIsTTY = process.stderr.isTTY;
    Object.defineProperty(process.stderr, "isTTY", { value: false, configurable: true });
    try {
      const progress = createFlowProgress({
        verbose: false,
        steps: [{ id: "1", label: "Step", initialTotal: 1 }],
      });
      assert.equal(progress, noopFlowProgress);
    } finally {
      Object.defineProperty(process.stderr, "isTTY", { value: originalIsTTY, configurable: true });
    }
  });
});

describe("createCliProgressFlow", () => {
  it("forces MultiBar redraw after tick and setTotal", () => {
    const originalIsTTY = process.stderr.isTTY;
    Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });

    let updateCalls = 0;
    const originalUpdate = MultiBar.prototype.update;
    MultiBar.prototype.update = function update(this: MultiBar) {
      updateCalls += 1;
      return originalUpdate.call(this);
    };

    try {
      const progress = createCliProgressFlow([
        { id: "1", label: "Step 1", initialTotal: 2 },
        { id: "2", label: "Step 2", initialTotal: 0 },
      ]);

      const initialUpdates = updateCalls;
      assert.ok(initialUpdates >= 1, "expected initial redraw after bar creation");

      progress.step("1").tick(1);
      assert.equal(updateCalls, initialUpdates + 1);

      progress.step("2").setTotal(10);
      assert.equal(updateCalls, initialUpdates + 2);

      progress.stop();
    } finally {
      MultiBar.prototype.update = originalUpdate;
      Object.defineProperty(process.stderr, "isTTY", { value: originalIsTTY, configurable: true });
    }
  });
});

describe("forEachRepository", () => {
  it("invokes callback and ticks progress once per repository", () => {
    const store = new RunEntityStore({
      sourceDirs: ["/src"],
      scanId: "20260101T000000000",
      runStartedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    store.addCreateIntents("scan.scope", { groupId: "scan.scope", artifactId: "git-repositories" }, {
      entities: {
        Repository: [
          new Repository({ localPath: "/repo-a", vcs: "git", buildSystems: ["maven"] }).toCreateIntent(),
          new Repository({ localPath: "/repo-b", vcs: "git", buildSystems: ["maven"] }).toCreateIntent(),
        ],
      },
    });

    let tickCount = 0;
    const progress: StepProgressHandle = {
      tick(count = 1): void {
        tickCount += count;
      },
      setTotal(): void {},
    };

    const visited: string[] = [];
    const snapshot = store.snapshot();
    const input: ScanAppInput = new Proxy(snapshot, {
      get(target, prop, receiver) {
        if (prop === "progress") {
          return progress;
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    forEachRepository(input, (repository) => {
      visited.push(repository.localPath);
    });

    assert.deepEqual(visited.sort(), ["/repo-a", "/repo-b"]);
    assert.equal(tickCount, 2);
  });
});
