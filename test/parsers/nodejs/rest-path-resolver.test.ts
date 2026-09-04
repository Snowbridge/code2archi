import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveStringLiteral } from "../../../src/parsers/nodejs/rest-path-resolver.js";
import { parseNodejsSourceFile } from "../../../src/parsers/nodejs/typescript-compilation-unit.js";
import { walkNodes } from "../../../src/parsers/nodejs/nodejs-tree-sitter-utils.js";

describe("rest-path-resolver", () => {
  it("resolves template literals with static segments and :param placeholders", () => {
    const source = "const path = `/users/${id}/orders`;";
    const unit = parseNodejsSourceFile(source, "sample.ts");
    let templateNode;
    walkNodes(unit.root, (node) => {
      if (node.type === "template_string") {
        templateNode = node;
      }
    });
    assert.ok(templateNode);
    assert.equal(resolveStringLiteral(templateNode!, source), "/users/:param/orders");
  });

  it("resolves string concatenation", () => {
    const source = "const path = '/api' + '/users';";
    const unit = parseNodejsSourceFile(source, "sample.ts");
    let expressionNode;
    walkNodes(unit.root, (node) => {
      if (node.type === "binary_expression") {
        expressionNode = node;
      }
    });
    assert.ok(expressionNode);
    assert.equal(resolveStringLiteral(expressionNode!, source), "/api/users");
  });
});
