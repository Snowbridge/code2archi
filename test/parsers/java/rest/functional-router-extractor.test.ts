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

  it("extracts Spring RouterFunction from field initializer", () => {
    const routers = extractFunctionalRouters(parseJavaSourceFile(readFixture("spring-router-field.java")));

    assert.equal(routers.length, 1);
    assert.equal(routers[0]?.name, "userRoutes");
    assert.equal(routers[0]?.fqcn, "com.example.FieldRouterConfig#userRoutes");
    assert.deepEqual(routers[0]?.endpoints, ["GET /users", "GET /users/:id"]);
    assert.equal(routers[0]?.tcpStackType, "NON_BLOCKING");
  });

  it("extracts Micronaut DefaultRouteBuilder routes", () => {
    const routers = extractFunctionalRouters(
      parseJavaSourceFile(readFixture("micronaut-default-route-builder.java")),
    );

    assert.equal(routers.length, 1);
    assert.equal(routers[0]?.name, "issuesRoutes");
    assert.deepEqual(routers[0]?.endpoints, ["GET /issues/show/:number"]);
  });

  it("extracts Quarkus Vert.x Router observe method routes", () => {
    const routers = extractFunctionalRouters(parseJavaSourceFile(readFixture("quarkus-vertx-router.java")));

    assert.equal(routers.length, 1);
    assert.equal(routers[0]?.name, "init");
    assert.deepEqual(routers[0]?.endpoints, ["GET /hello", "POST /items"]);
    assert.equal(routers[0]?.tcpStackType, "BLOCKING");
  });

  it("extracts Quarkus @Route reactive routes per class", () => {
    const routers = extractFunctionalRouters(
      parseJavaSourceFile(readFixture("quarkus-reactive-routes.java")),
    );

    assert.equal(routers.length, 1);
    assert.equal(routers[0]?.name, "ReactiveRoutes");
    assert.equal(routers[0]?.fqcn, "com.example.ReactiveRoutes");
    assert.deepEqual(routers[0]?.endpoints, ["GET /hello", "GET /world"]);
  });

  it("extracts Spring RouterFunctions.route and andRoute", () => {
    const routers = extractFunctionalRouters(
      parseJavaSourceFile(readFixture("router-functions-and-route.java")),
    );

    assert.equal(routers.length, 1);
    assert.equal(routers[0]?.name, "combinedRoutes");
    assert.deepEqual(routers[0]?.endpoints, ["GET /users", "POST /users"]);
  });
});
