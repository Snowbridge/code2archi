import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inheritModuleVersions,
  moduleIdForCoordinates,
  type ModuleDiscoveryInput,
} from "../../../../src/processors/scan/source/module-discovery.js";
import { UNKNOWN_VERSION } from "../../../../src/parsers/build-tool-versions.js";

function moduleInput(
  overrides: Partial<ModuleDiscoveryInput> &
    Pick<ModuleDiscoveryInput, "artifactId" | "groupId">,
): ModuleDiscoveryInput {
  return {
    repositoryId: "repo-1",
    buildSystem: "gradle",
    groupId: overrides.groupId,
    artifactId: overrides.artifactId,
    version: "1.0.0",
    name: overrides.artifactId,
    repoPath: ".",
    buildScript: "build.gradle",
    isMultimodule: false,
    buildToolVersion: UNKNOWN_VERSION,
    javaVersion: UNKNOWN_VERSION,
    kotlinJvmTarget: UNKNOWN_VERSION,
    kotlinCompilerVersion: UNKNOWN_VERSION,
    nodeVersion: UNKNOWN_VERSION,
    typescriptVersion: UNKNOWN_VERSION,
    tsxVersion: UNKNOWN_VERSION,
    dependencies: [],
    ...overrides,
  };
}

describe("inheritModuleVersions", () => {
  it("inherits buildToolVersion and javaVersion from parent when child values are unknown", () => {
    const parentId = moduleIdForCoordinates("repo-1", "gradle", "com.example", "parent");
    const modules = inheritModuleVersions([
      moduleInput({
        groupId: "com.example",
        artifactId: "parent",
        buildToolVersion: "8.5",
        javaVersion: "17",
        isMultimodule: true,
      }),
      moduleInput({
        groupId: "com.example",
        artifactId: "child",
        repoPath: "child",
        buildScript: "child/build.gradle",
        parentModuleId: parentId,
      }),
    ]);

    const child = modules.find((module) => module.artifactId === "child");
    assert.equal(child?.buildToolVersion, "8.5");
    assert.equal(child?.javaVersion, "17");
  });

  it("keeps local version when child defines a non-unknown value", () => {
    const parentId = moduleIdForCoordinates("repo-1", "gradle", "com.example", "parent");
    const modules = inheritModuleVersions([
      moduleInput({
        groupId: "com.example",
        artifactId: "parent",
        javaVersion: "17",
      }),
      moduleInput({
        groupId: "com.example",
        artifactId: "child",
        parentModuleId: parentId,
        javaVersion: "21",
      }),
    ]);

    const child = modules.find((module) => module.artifactId === "child");
    assert.equal(child?.javaVersion, "21");
  });

  it("inherits through multi-level parent chain", () => {
    const rootId = moduleIdForCoordinates("repo-1", "gradle", "com.example", "root");
    const middleId = moduleIdForCoordinates("repo-1", "gradle", "com.example", "middle");
    const modules = inheritModuleVersions([
      moduleInput({
        groupId: "com.example",
        artifactId: "root",
        nodeVersion: ">=18.0.0",
      }),
      moduleInput({
        groupId: "com.example",
        artifactId: "middle",
        parentModuleId: rootId,
      }),
      moduleInput({
        groupId: "com.example",
        artifactId: "leaf",
        parentModuleId: middleId,
      }),
    ]);

    const leaf = modules.find((module) => module.artifactId === "leaf");
    assert.equal(leaf?.nodeVersion, ">=18.0.0");
  });
});
