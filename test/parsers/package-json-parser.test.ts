import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { parseNpmRepository } from "../../src/parsers/package-json-parser.js";
import { createTestTempDir } from "../test-temp-dir.js";

describe("package-json-parser", () => {
  it("parses root package dependencies", () => {
    const root = createTestTempDir("c2a-npm-single-");
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "@acme/portal",
        version: "1.2.3",
        dependencies: {
          lodash: "^4.17.21",
        },
      }),
    );

    const modules = parseNpmRepository(root);
    assert.equal(modules.length, 1);
    assert.equal(modules[0]?.groupId, "acme");
    assert.equal(modules[0]?.artifactId, "portal");
    assert.equal(modules[0]?.dependencies.lodash, "^4.17.21");
  });

  it("parses workspace packages", () => {
    const root = createTestTempDir("c2a-npm-workspace-");
    mkdirSync(path.join(root, "packages", "api"), { recursive: true });
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "workspace-root",
        version: "0.0.0",
        workspaces: ["packages/*"],
      }),
    );
    writeFileSync(
      path.join(root, "packages", "api", "package.json"),
      JSON.stringify({
        name: "@acme/api",
        version: "0.1.0",
        dependencies: {
          express: "4.18.0",
        },
      }),
    );

    const modules = parseNpmRepository(root);
    assert.equal(modules.length, 2);
    assert.equal(modules[0]?.isMultimodule, true);
    const api = modules.find((module) => module.artifactId === "api");
    assert.equal(api?.parentName, "workspace-root");
    assert.equal(api?.dependencies.express, "4.18.0");
  });
});
