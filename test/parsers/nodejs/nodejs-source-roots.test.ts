import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../src/discovery-model/entities/application-module.js";
import { Repository } from "../../../src/discovery-model/entities/repository.js";
import { isEligibleNpmModule } from "../../../src/parsers/nodejs/nodejs-source-roots.js";
import {
  hasFrameworkPackage,
  hasNpmToolchainInPackageTree,
} from "../../../src/parsers/nodejs/package-json-framework-deps.js";
import { createTestTempDir } from "../../test-temp-dir.js";

function npmModule(
  repositoryId: string,
  repoPath: string,
): ReturnType<ApplicationModule["toCreateIntent"]> {
  return new ApplicationModule({
    repositoryId,
    buildSystem: "npm",
    groupId: "",
    artifactId: path.basename(repoPath) || "root",
    version: "1.0.0",
    name: path.basename(repoPath) || "root",
    repoPath,
    buildScript: path.join(repoPath, "package.json").replace(/\\/g, "/"),
    isMultimodule: false,
    nodeVersion: "unknown",
    typescriptVersion: "unknown",
    tsxVersion: "unknown",
  }).toCreateIntent();
}

describe("nodejs source roots eligibility", () => {
  it("treats npm module as eligible when express is declared in workspace root package.json", () => {
    const root = createTestTempDir("c2a-nodejs-eligibility-");
    const packagesDir = path.join(root, "packages", "api");
    mkdirSync(packagesDir, { recursive: true });

    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "demo",
        private: true,
        workspaces: ["packages/*"],
        devDependencies: { typescript: "^5.0.0" },
      }),
    );
    writeFileSync(
      path.join(packagesDir, "package.json"),
      JSON.stringify({
        name: "api",
        version: "1.0.0",
        dependencies: { express: "^4.18.0" },
      }),
    );

    const repository = new Repository({
      url: "",
      localPath: root,
      name: "demo",
      namespace: "",
      buildSystems: ["npm"],
    });
    const module = npmModule(repository.id, "packages/api");

    assert.equal(isEligibleNpmModule(module, repository), true);
    assert.equal(hasNpmToolchainInPackageTree(path.join(root, "packages/api"), root), true);
    assert.equal(
      hasFrameworkPackage(path.join(root, "packages/api"), "express", root),
      true,
    );
  });

  it("treats plain JS express package as eligible without engines or typescript metadata", () => {
    const root = createTestTempDir("c2a-nodejs-eligibility-js-");
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "api",
        version: "1.0.0",
        dependencies: { express: "^4.18.0" },
      }),
    );

    const repository = new Repository({
      url: "",
      localPath: root,
      name: "api",
      namespace: "",
      buildSystems: ["npm"],
    });
    const module = npmModule(repository.id, ".");

    assert.equal(isEligibleNpmModule(module, repository), true);
  });
});
