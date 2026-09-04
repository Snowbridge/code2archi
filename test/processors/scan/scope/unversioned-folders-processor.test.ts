import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { UnversionedFoldersProcessor } from "../../../../src/processors/scan/scope/unversioned-folders-processor.js";
import { Repository } from "../../../../src/discovery-model/entities/repository.js";
import { createTestTempDir } from "../../../test-temp-dir.js";

describe("UnversionedFoldersProcessor", () => {
  it("exposes scan.scope coordinates and ON_DEMAND policy", () => {
    const processor = new UnversionedFoldersProcessor();

    assert.deepEqual(processor.id, {
      groupId: "scan.scope",
      artifactId: "unversioned-folders",
    });
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ON_DEMAND");
  });

  it("creates one Repository per sourceDir without traversal", () => {
    const root = createTestTempDir("c2a-unversioned-");
    const first = path.join(root, "first");
    const second = path.join(root, "second");
    mkdirSync(first, { recursive: true });
    mkdirSync(second, { recursive: true });
    writeFileSync(path.join(first, "pom.xml"), "<project/>", "utf8");

    const processor = new UnversionedFoldersProcessor();
    const result = processor.process({ sourceDirs: [first, second] });

    assert.equal(result.length, 2);
    assert.equal(result[0]?.name, "first");
    assert.equal(result[0]?.url, "");
    assert.deepEqual(result[0]?.buildSystems, ["maven"]);
    assert.equal(
      result[0]?.id,
      new Repository({
        url: "",
        localPath: path.resolve(first),
        name: "first",
        namespace: result[0]?.namespace ?? "",
        buildSystems: ["maven"],
      }).id,
    );
    assert.equal(result[1]?.name, "second");
    assert.equal(result[1]?.url, "");
    assert.deepEqual(result[1]?.buildSystems, []);
  });
});
