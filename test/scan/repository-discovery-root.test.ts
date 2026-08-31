import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import {
  computeRepositoryCommonRoot,
  computeRepositoryNamespace,
} from "../../src/scan/repository-discovery-root.js";

describe("repository-discovery-root", () => {
  it("computes common root for sibling repository paths", () => {
    const common = computeRepositoryCommonRoot([
      "/f/foo/bar/buzz/common",
      "/f/foo/bar/buzz/auth",
    ]);
    assert.equal(common, path.resolve("/f/foo/bar/buzz"));
  });

  it("computes common root for divergent repository paths", () => {
    const common = computeRepositoryCommonRoot([
      "/f/foo/bar/buuz/common",
      "/f/foo/buzz/bar/auth",
    ]);
    assert.equal(common, path.resolve("/f/foo"));
  });

  it("returns empty string for empty input", () => {
    assert.equal(computeRepositoryCommonRoot([]), "");
  });

  it("returns empty string when only filesystem root is shared", () => {
    const fsRoot = path.parse(path.resolve("/")).root;
    const left = path.join(fsRoot, "c2a-root-left", "repo-a");
    const right = path.join(fsRoot, "c2a-root-right", "repo-b");
    assert.equal(computeRepositoryCommonRoot([left, right]), "");
  });

  it("computes namespace relative to common root without repo folder name", () => {
    const namespace = computeRepositoryNamespace(
      path.resolve("/f/foo/fizz"),
      path.resolve("/f/foo/fizz/fuzz/bar/buzz/repository-folder"),
    );
    assert.equal(namespace, "fuzz/bar/buzz");
  });

  it("returns empty namespace when common root is empty", () => {
    assert.equal(
      computeRepositoryNamespace("", path.resolve("/f/foo/fizz/repo")),
      "",
    );
  });
});
