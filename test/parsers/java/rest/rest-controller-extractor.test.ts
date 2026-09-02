import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parseJavaSourceFile } from "../../../../src/parsers/java/java-compilation-unit.js";
import { extractRestControllers } from "../../../../src/parsers/java/rest/rest-controller-extractor.js";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/java-rest-controllers",
);

function readFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf8");
}

describe("extractRestControllers", () => {
  it("extracts Spring RestController from spec example", () => {
    const controllers = extractRestControllers(parseJavaSourceFile(readFixture("spring-entity-controller.java")));

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "EntityController");
    assert.equal(controllers[0]?.fqcn, "com.example.EntityController");
    assert.deepEqual(controllers[0]?.endpoints, ["PUT /api/entity/:id"]);
    assert.ok(controllers[0]?.dtoFqcn.includes("com.example.dto.EntityDto"));
    assert.ok(!controllers[0]?.dtoFqcn.some((fqcn) => fqcn.includes("ResponseEntity")));
    assert.equal(controllers[0]?.tcpStackType, "BLOCKING");
  });

  it("detects Spring Controller only when handler mapping exists", () => {
    const withoutMapping = extractRestControllers(
      parseJavaSourceFile(readFixture("spring-controller-without-mapping.java")),
    );
    const withMapping = extractRestControllers(
      parseJavaSourceFile(readFixture("spring-controller-with-mapping.java")),
    );

    assert.equal(withoutMapping.length, 0);
    assert.equal(withMapping.length, 1);
    assert.deepEqual(withMapping[0]?.endpoints, ["GET /health"]);
  });

  it("extracts WebFlux Mono return DTO", () => {
    const controllers = extractRestControllers(parseJavaSourceFile(readFixture("spring-webflux-controller.java")));

    assert.equal(controllers.length, 1);
    assert.ok(controllers[0]?.dtoFqcn.includes("com.example.dto.EntityDto"));
    assert.equal(controllers[0]?.tcpStackType, "NON_BLOCKING");
  });

  it("extracts Quarkus JAX-RS resource", () => {
    const controllers = extractRestControllers(parseJavaSourceFile(readFixture("quarkus-jaxrs-resource.java")));

    assert.equal(controllers.length, 1);
    assert.deepEqual(controllers[0]?.endpoints, ["GET /v1/items/:id"]);
    assert.equal(controllers[0]?.tcpStackType, "BLOCKING");
  });

  it("extracts Micronaut controller", () => {
    const controllers = extractRestControllers(parseJavaSourceFile(readFixture("micronaut-user-controller.java")));

    assert.equal(controllers.length, 1);
    assert.deepEqual(controllers[0]?.endpoints, ["GET /api/users/:id"]);
  });

  it("extracts inner class controller with dollar FQCN", () => {
    const controllers = extractRestControllers(parseJavaSourceFile(readFixture("spring-inner-controller.java")));

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.fqcn, "com.example.Outer$InnerController");
  });

  it("collects DTO types from @PathVariable parameters", () => {
    const controllers = extractRestControllers(parseJavaSourceFile(readFixture("spring-path-param-dto.java")));

    assert.equal(controllers.length, 1);
    assert.ok(controllers[0]?.dtoFqcn.includes("com.example.dto.EntityDto"));
    assert.ok(controllers[0]?.dtoFqcn.includes("com.example.dto.EntityId"));
  });

  it("extracts implemented interface FQCN from implements clause", () => {
    const compilationUnit = parseJavaSourceFile(
      readFixture("spring-rest-controller-implements-api.java"),
    );

    assert.equal(compilationUnit.types[0]?.interfaces.length, 1);

    const controllers = extractRestControllers(compilationUnit);

    assert.equal(controllers.length, 1);
    assert.deepEqual(controllers[0]?.implementedInterfaceFqcn, ["com.example.api.ProcurementApi"]);
  });
});
