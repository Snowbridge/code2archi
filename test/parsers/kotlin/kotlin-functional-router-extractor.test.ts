import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parseKotlinSourceFile } from "../../../src/parsers/kotlin/kotlin-compilation-unit.js";
import { extractKotlinFunctionalRouters } from "../../../src/parsers/kotlin/kotlin-functional-router-extractor.js";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/kotlin-rest-controllers/functional",
);

function readFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf8");
}

function parseFixture(name: string) {
  const baseName = name.replace(/\.kt$/, "");
  return parseKotlinSourceFile(readFixture(name), { fileBaseName: baseName });
}

describe("extractKotlinFunctionalRouters", () => {
  it("extracts Spring Kotlin RouterFunction @Bean", () => {
    const routers = extractKotlinFunctionalRouters(parseFixture("spring-router-function-bean.kt"));

    assert.equal(routers.length, 1);
    assert.equal(routers[0]?.name, "userRoutes");
    assert.equal(routers[0]?.fqcn, "com.example.UserRouterConfig#userRoutes");
    assert.deepEqual(routers[0]?.endpoints, ["GET /users", "GET /users/:id"]);
    assert.equal(routers[0]?.tcpStackType, "NON_BLOCKING");
  });

  it("extracts Spring Kotlin CoRouterFunction @Bean", () => {
    const routers = extractKotlinFunctionalRouters(parseFixture("spring-co-router-bean.kt"));

    assert.equal(routers.length, 1);
    assert.equal(routers[0]?.name, "coRoutes");
    assert.deepEqual(routers[0]?.endpoints, ["GET /items"]);
    assert.equal(routers[0]?.tcpStackType, "NON_BLOCKING");
  });

  it("extracts Spring Kotlin RouterFunction property", () => {
    const routers = extractKotlinFunctionalRouters(parseFixture("spring-router-property.kt"));

    assert.equal(routers.length, 1);
    assert.equal(routers[0]?.name, "userRoutes");
    assert.deepEqual(routers[0]?.endpoints, ["GET /users"]);
  });

  it("extracts Ktor routing host function", () => {
    const routers = extractKotlinFunctionalRouters(parseFixture("ktor-routing-host.kt"));

    assert.equal(routers.length, 1);
    assert.equal(routers[0]?.name, "module");
    assert.equal(routers[0]?.fqcn, "com.example.ktor-routing-hostKt#module");
    assert.deepEqual(routers[0]?.endpoints, ["GET /hello"]);
  });

  it("extracts Ktor Route extension function", () => {
    const routers = extractKotlinFunctionalRouters(parseFixture("ktor-route-extension.kt"));

    assert.equal(routers.length, 1);
    assert.equal(routers[0]?.name, "apiRoutes");
    assert.deepEqual(routers[0]?.endpoints, ["GET /api/items"]);
  });

  it("extracts Micronaut DefaultRouteBuilder routes", () => {
    const routers = extractKotlinFunctionalRouters(parseFixture("micronaut-route-builder.kt"));

    assert.equal(routers.length, 1);
    assert.equal(routers[0]?.name, "issuesRoutes");
    assert.deepEqual(routers[0]?.endpoints, ["GET /issues/show/:number"]);
  });

  it("extracts Quarkus Vert.x Router observe method routes", () => {
    const routers = extractKotlinFunctionalRouters(parseFixture("quarkus-vertx-router.kt"));

    assert.equal(routers.length, 1);
    assert.equal(routers[0]?.name, "init");
    assert.deepEqual(routers[0]?.endpoints, ["GET /hello", "POST /items"]);
  });

  it("extracts Quarkus @Route reactive routes per class", () => {
    const routers = extractKotlinFunctionalRouters(parseFixture("quarkus-reactive-routes.kt"));

    assert.equal(routers.length, 1);
    assert.equal(routers[0]?.name, "ReactiveRoutes");
    assert.equal(routers[0]?.fqcn, "com.example.ReactiveRoutes");
    assert.deepEqual(routers[0]?.endpoints, ["GET /hello", "GET /world"]);
  });
});
