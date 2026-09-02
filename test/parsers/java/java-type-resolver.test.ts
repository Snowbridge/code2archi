import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseJavaSourceFile } from "../../../src/parsers/java/java-compilation-unit.js";
import { extractRestControllers } from "../../../src/parsers/java/rest/rest-controller-extractor.js";

describe("parseTypeRef", () => {
  it("parses nested generic type arguments in referenceType wrappers", () => {
    const type = parseJavaSourceFile(
      "class C { ResponseEntity<List<Procurement>> m() {} }",
    ).types[0];

    assert.deepEqual(type?.methods[0]?.returnType?.typeArguments[0], {
      raw: "List",
      simpleName: "List",
      typeArguments: [{ raw: "Procurement", simpleName: "Procurement", typeArguments: [] }],
    });
  });
});

describe("contract-first dtoFqcn with collection return types", () => {
  it("extracts DTO from ResponseEntity<List<Dto>> override method", () => {
    const source = `package com.example;

import com.example.api.ProcurementsApi;
import com.example.model.Procurement;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
public class ProcurementsController implements ProcurementsApi {
    @Override
    public ResponseEntity<List<Procurement>> getProcurements(String registrationNumber) {
        return ResponseEntity.ok(List.of());
    }
}`;

    const controllers = extractRestControllers(parseJavaSourceFile(source));

    assert.equal(controllers.length, 1);
    assert.deepEqual(controllers[0]?.dtoFqcn, ["com.example.model.Procurement"]);
    assert.deepEqual(controllers[0]?.endpoints, []);
  });
});
