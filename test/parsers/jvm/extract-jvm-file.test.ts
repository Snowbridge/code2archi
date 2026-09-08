import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractJvmFileModel, tryExtractJvmFileModel } from "../../../src/parsers/jvm/extract-jvm-file.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/jvm/rest/spring/UserController.java",
);

const PARSE_FAILURE_FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/jvm/rest/spring/TreeSitterParseFailure.java",
);

describe("extractJvmFileModel", () => {
  it("parses Spring controller class and method mappings", () => {
    const source = readFileSync(FIXTURE, "utf8");
    const model = extractJvmFileModel(source, "java");
    assert.equal(model.packageName, "com.example.api");
    assert.equal(model.types.length, 1);
    const controller = model.types[0]!;
    assert.equal(controller.simpleName, "UserController");
    assert.equal(controller.implementedInterfaces.includes("UserContract"), true);
    assert.equal(controller.methods.length, 1);
    assert.equal(controller.methods[0]?.name, "list");
  });

  it("tryExtractJvmFileModel returns undefined when tree-sitter throws", () => {
    const source = readFileSync(PARSE_FAILURE_FIXTURE, "utf8");
    assert.equal(tryExtractJvmFileModel(source, "java"), undefined);
  });
});
