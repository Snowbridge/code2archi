import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parseJavaSourceFile } from "../../../../src/parsers/java/java-compilation-unit.js";
import { extractFunctionalRouters } from "../../../../src/parsers/java/rest/functional-router-extractor.js";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/java-rest-controllers/functional",
);

function readFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf8");
}

describe("extractFunctionalRouters", () => {
  it("extracts Spring WebFlux RouterFunction bean from spec example", () => {
    const routers = extractFunctionalRouters(parseJavaSourceFile(readFixture("user-router-config.java")));

    assert.equal(routers.length, 1);
    assert.equal(routers[0]?.name, "userRoutes");
    assert.equal(routers[0]?.fqcn, "com.example.UserRouterConfig#userRoutes");
    assert.deepEqual(routers[0]?.endpoints, [
      "GET /users",
      "GET /users/:id",
      "PUT /users/:id",
    ]);
    assert.deepEqual(routers[0]?.dtoFqcn, []);
    assert.equal(routers[0]?.tcpStackType, "NON_BLOCKING");
  });
});
