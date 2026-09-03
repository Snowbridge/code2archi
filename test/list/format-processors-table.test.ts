import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatGroupsTable,
  formatProcessorsTable,
} from "../../src/list/format-processors-table.js";

describe("formatProcessorsTable", () => {
  it("aligns columns and includes header", () => {
    const table = formatProcessorsTable([
      {
        groupId: "scan.scope",
        artifactId: "git-repos",
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
    assert.equal(lines.length, 3);
    assert.ok(lines[0]!.startsWith("groupId"));
    assert.ok(lines[0]!.includes("artifactId"));
    assert.ok(lines[1]!.includes("git-repos"));
    assert.ok(lines[2]!.includes("unversioned-folders"));
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
