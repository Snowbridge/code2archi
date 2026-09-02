import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parseKotlinSourceFile } from "../../../src/parsers/kotlin/kotlin-compilation-unit.js";
import { extractKotlinRestControllers } from "../../../src/parsers/kotlin/kotlin-rest-source-adapter.js";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/kotlin-rest-controllers",
);

function readFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf8");
}

describe("extractKotlinRestControllers", () => {
  it("extracts Spring RestController from spec example", () => {
    const controllers = extractKotlinRestControllers(
      parseKotlinSourceFile(readFixture("spring-entity-controller.kt")),
    );

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "EntityController");
    assert.equal(controllers[0]?.fqcn, "com.example.EntityController");
    assert.deepEqual(controllers[0]?.endpoints, ["PUT /api/entity/:id"]);
    assert.ok(controllers[0]?.dtoFqcn.includes("com.example.dto.EntityDto"));
    assert.ok(!controllers[0]?.dtoFqcn.some((fqcn) => fqcn.includes("ResponseEntity")));
    assert.equal(controllers[0]?.tcpStackType, "BLOCKING");
  });

  it("marks suspend handlers as NON_BLOCKING", () => {
    const controllers = extractKotlinRestControllers(
      parseKotlinSourceFile(readFixture("spring-webflux-suspend-controller.kt")),
    );

    assert.equal(controllers.length, 1);
    assert.ok(controllers[0]?.dtoFqcn.includes("com.example.dto.EntityDto"));
    assert.equal(controllers[0]?.tcpStackType, "NON_BLOCKING");
  });

  it("extracts Quarkus JAX-RS resource", () => {
    const controllers = extractKotlinRestControllers(
      parseKotlinSourceFile(readFixture("quarkus-jaxrs-resource.kt")),
    );

    assert.equal(controllers.length, 1);
    assert.deepEqual(controllers[0]?.endpoints, ["GET /v1/items/:id"]);
    assert.equal(controllers[0]?.tcpStackType, "BLOCKING");
  });

  it("extracts implemented interface FQCN from class delegation specifiers", () => {
    const controllers = extractKotlinRestControllers(
      parseKotlinSourceFile(readFixture("spring-interface-controller.kt")),
    );

    assert.equal(controllers.length, 1);
    assert.deepEqual(controllers[0]?.implementedInterfaceFqcn, ["com.example.api.LotsCrudApi"]);
    assert.ok(controllers[0]?.dtoFqcn.includes("com.example.LotRequest"));
  });

  it("extracts Micronaut controller", () => {
    const controllers = extractKotlinRestControllers(
      parseKotlinSourceFile(readFixture("micronaut-user-controller.kt")),
    );

    assert.equal(controllers.length, 1);
    assert.deepEqual(controllers[0]?.endpoints, ["GET /api/users/:id"]);
  });

  it("collects DTO types from @PathVariable parameters", () => {
    const controllers = extractKotlinRestControllers(
      parseKotlinSourceFile(readFixture("spring-path-param-dto.kt")),
    );

    assert.equal(controllers.length, 1);
    assert.ok(controllers[0]?.dtoFqcn.includes("com.example.dto.EntityDto"));
    assert.ok(controllers[0]?.dtoFqcn.includes("com.example.dto.EntityId"));
  });
});
