import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ModuleBindingResolutionError,
  parseCjsRequires,
  resolveCjsBinding,
} from "../../../src/parsers/type-resolution/index.js";

const CJS_SOURCE = `
const { myFunction, myVariable } = require('./myModule');
const fs = require("fs");
`;

describe("resolve-cjs-binding", () => {
  const bindings = parseCjsRequires(CJS_SOURCE);

  it("resolves destructured require binding", () => {
    assert.equal(
      resolveCjsBinding("myFunction", bindings),
      "myFunction#const { myFunction, myVariable } = require('./myModule');",
    );
    assert.equal(
      resolveCjsBinding("myVariable", bindings),
      "myVariable#const { myFunction, myVariable } = require('./myModule');",
    );
  });

  it("resolves simple require binding", () => {
    assert.equal(
      resolveCjsBinding("fs", bindings),
      'fs#const fs = require("fs");',
    );
  });

  it("throws for unresolved binding", () => {
    assert.throws(
      () => resolveCjsBinding("path", bindings),
      (error: unknown) => error instanceof ModuleBindingResolutionError,
    );
  });
});
