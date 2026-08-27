import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { detectBuildSystems } from "../../../src/processors/scan-scope/detect-build-systems.js";
import { createTestTempDir } from "../../test-temp-dir.js";

describe("detectBuildSystems", () => {
  it("detects maven, gradle, and npm in repository root", () => {
    const root = createTestTempDir("c2a-build-");
    writeFileSync(path.join(root, "pom.xml"), "<project/>", "utf8");
    writeFileSync(path.join(root, "build.gradle.kts"), "plugins {}", "utf8");
    writeFileSync(path.join(root, "package.json"), "{}", "utf8");
    mkdirSync(path.join(root, "src"));

    assert.deepEqual(detectBuildSystems(root), ["maven", "gradle", "npm"]);
  });

  it("returns empty array when no build files exist", () => {
    const root = createTestTempDir("c2a-build-empty-");
    mkdirSync(path.join(root, "src"));

    assert.deepEqual(detectBuildSystems(root), []);
  });

  it("does not detect build files in nested directories", () => {
    const root = createTestTempDir("c2a-build-nested-");
    const nested = path.join(root, "module");
    mkdirSync(nested, { recursive: true });
    writeFileSync(path.join(nested, "pom.xml"), "<project/>", "utf8");

    assert.deepEqual(detectBuildSystems(root), []);
  });
});
