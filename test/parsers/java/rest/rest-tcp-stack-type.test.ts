import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JavaMethodDeclaration } from "../../../../src/parsers/java/java-ast-model.js";
import { resolveTcpStackType } from "../../../../src/parsers/java/rest/rest-tcp-stack-type.js";

function method(returnType: JavaMethodDeclaration["returnType"]): JavaMethodDeclaration {
  return {
    name: "m",
    returnType,
    parameters: [],
    annotations: [],
  };
}

describe("resolveTcpStackType", () => {
  it("returns BLOCKING for synchronous return types", () => {
    assert.equal(
      resolveTcpStackType([
        method({ raw: "ResponseEntity", simpleName: "ResponseEntity", typeArguments: [] }),
        method({ raw: "ItemDto", simpleName: "ItemDto", typeArguments: [] }),
      ]),
      "BLOCKING",
    );
  });

  it("returns NON_BLOCKING when any handler returns Mono, Flux, Uni, or Multi", () => {
    for (const reactiveType of ["Mono", "Flux", "Uni", "Multi"] as const) {
      assert.equal(
        resolveTcpStackType([
          method({ raw: "ItemDto", simpleName: "ItemDto", typeArguments: [] }),
          method({
            raw: reactiveType,
            simpleName: reactiveType,
            typeArguments: [{ raw: "ItemDto", simpleName: "ItemDto", typeArguments: [] }],
          }),
        ]),
        "NON_BLOCKING",
      );
    }
  });

  it("detects reactive wrappers in nested generic return types", () => {
    assert.equal(
      resolveTcpStackType([
        method({
          raw: "ResponseEntity",
          simpleName: "ResponseEntity",
          typeArguments: [
            {
              raw: "Flux",
              simpleName: "Flux",
              typeArguments: [{ raw: "ItemDto", simpleName: "ItemDto", typeArguments: [] }],
            },
          ],
        }),
      ]),
      "NON_BLOCKING",
    );
  });
});
