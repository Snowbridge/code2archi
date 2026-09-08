import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseCjsRequires,
  parseEsmImports,
  parseJavaImports,
  parseJavaPackage,
  parseKotlinImports,
  parseKotlinPackage,
} from "../../../src/parsers/type-resolution/index.js";

describe("parse-imports", () => {
  it("parses Java package and imports", () => {
    const source = `
package com.example.app;

import com.foo.Bar;
import com.bar.*;
import static com.baz.Util.VALUE;
`;

    assert.equal(parseJavaPackage(source), "com.example.app");
    assert.deepEqual(parseJavaImports(source), [
      { kind: "type", qualifiedName: "com.foo.Bar" },
      { kind: "wildcard", qualifiedName: "com.bar" },
      { kind: "type", qualifiedName: "com.baz.Util.VALUE" },
    ]);
  });

  it("parses Kotlin package and imports with alias", () => {
    const source = `
package com.example

import com.foo.Bar as Baz
import com.service.*
`;

    assert.equal(parseKotlinPackage(source), "com.example");
    assert.deepEqual(parseKotlinImports(source), [
      { kind: "type", qualifiedName: "com.foo.Bar", alias: "Baz" },
      { kind: "wildcard", qualifiedName: "com.service" },
    ]);
  });

  it("parses ESM import lines", () => {
    const bindings = parseEsmImports(
      `import foo, { bar as baz } from "./mod.js";`,
    );

    assert.equal(bindings.length, 2);
    assert.equal(bindings[0]?.literalName, "foo");
    assert.equal(bindings[1]?.literalName, "baz");
  });

  it("parses CJS require lines", () => {
    const bindings = parseCjsRequires(`const { a, b: c } = require('x');`);

    assert.deepEqual(
      bindings.map((binding) => binding.literalName),
      ["a", "c"],
    );
  });
});
