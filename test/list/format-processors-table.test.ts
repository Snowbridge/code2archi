import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatGroupsTable,
  formatProcessorsTable,
} from "../../src/list/format-processors-table.js";

describe("formatProcessorsTable", () => {
  it("groups processors by groupId with shared column header", () => {
    const table = formatProcessorsTable([
      {
        groupId: "scan.scope",
        artifactId: "git-repositories",
        version: "0.2.0",
        executionPolicy: "ALWAYS",
        description: "Discovers Git repository roots.",
      },
      {
        groupId: "scan.scope",
        artifactId: "unversioned-folders",
        version: "0.1.0",
        executionPolicy: "ON_DEMAND",
        description: "Discovers unversioned folders.",
      },
    ]);

    const lines = table.split("\n");
    assert.ok(lines[0]!.startsWith("artifactId"));
    assert.ok(lines[0]!.includes("executionPolicy"));
    assert.equal(lines[1], "");
    assert.equal(lines[2], "scan.scope");
    assert.ok(lines[3]!.includes("git-repositories"));
    assert.ok(lines[4]!.includes("unversioned-folders"));
  });

  it("returns empty string for no rows", () => {
    assert.equal(formatProcessorsTable([]), "");
    assert.equal(formatGroupsTable([]), "");
  });
});

describe("formatGroupsTable", () => {
  it("prints single groupId column", () => {
    const table = formatGroupsTable(["generate.elements.application", "scan.scope"]);
    const lines = table.split("\n").map((line) => line.trimEnd());
    assert.deepEqual(lines, ["groupId", "generate.elements.application", "scan.scope"]);
  });
});
