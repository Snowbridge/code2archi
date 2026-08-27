import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { computeRepositoryNamespace } from "../../../src/processors/scan-scope/compute-repository-namespace.js";

function posixNamespace(from: string, to: string): string {
  const relative = path.relative(path.resolve(from), path.resolve(to));
  return `/${relative.split(path.sep).join("/")}`;
}

describe("computeRepositoryNamespace", () => {
  it("strips common path prefix from sourceDirs", () => {
    const workspaceA = path.resolve("/workspace/a");
    const workspaceB = path.resolve("/workspace/b");
    const repo = path.resolve("/workspace/a/my-app");

    const namespace = computeRepositoryNamespace([workspaceA, workspaceB], repo);

    assert.equal(namespace, posixNamespace(path.resolve("/workspace"), repo));
  });

  it("returns full localPath when sourceDirs share only filesystem root", () => {
    const foo = path.resolve("/x/foo");
    const bar = path.resolve("/y/bar");
    const repo = path.resolve("/x/foo/repo");

    const namespace = computeRepositoryNamespace([foo, bar], repo);

    assert.equal(namespace, path.resolve(repo));
  });

  it("strips a single source directory prefix", () => {
    const sourceDir = path.resolve("/workspace/a");
    const repo = path.resolve("/workspace/a/my-app");

    const namespace = computeRepositoryNamespace([sourceDir], repo);

    assert.equal(namespace, posixNamespace(sourceDir, repo));
  });
});
