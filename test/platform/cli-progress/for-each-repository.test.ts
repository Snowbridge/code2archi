import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCodeInventorySnapshot } from "../../../src/code-inventory/code-inventory-snapshot.js";
import { tickRepositoryProgress } from "../../../src/platform/cli-progress/for-each-repository.js";
import type { ScanAppInput } from "../../../src/platform/processors/processor.js";

describe("tickRepositoryProgress", () => {
  it("ticks once per repository in snapshot", () => {
    let ticks = 0;
    const snapshot = buildCodeInventorySnapshot({
      scanId: "scan-1",
      sourceRoot: "/repo",
      runStartedAt: new Date("2026-01-01T00:00:00Z"),
      entityArrays: {
        Repository: [
          {
            id: "repo-1",
            name: "a",
            namespace: "",
            localPath: "/repo/a",
            url: "",
            buildSystems: ["gradle"],
            extractProcessor: "test",
            extractSchema: "0.0.0",
            extractedAt: "2026-01-01T00:00:00+00:00",
          },
          {
            id: "repo-2",
            name: "b",
            namespace: "",
            localPath: "/repo/b",
            url: "",
            buildSystems: ["gradle"],
            extractProcessor: "test",
            extractSchema: "0.0.0",
            extractedAt: "2026-01-01T00:00:00+00:00",
          },
        ],
      },
    });
    const input: ScanAppInput = new Proxy(snapshot, {
      get(target, prop, receiver) {
        if (prop === "progress") {
          return { tick: (count = 1) => {
            ticks += count;
          } };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    tickRepositoryProgress(input);
    assert.equal(ticks, 2);
  });
});
