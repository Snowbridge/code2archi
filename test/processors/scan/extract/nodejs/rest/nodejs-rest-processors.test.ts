import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ApplicationModule } from "../../../../../../src/discovery-model/entities/application-module.js";
import { Repository } from "../../../../../../src/discovery-model/entities/repository.js";
import { RunEntityStore } from "../../../../../../src/discovery-model/run-entity-store.js";
import { NodejsRestClientProgrammaticProcessor } from "../../../../../../src/processors/scan/extract/nodejs/rest/client-programmatic-processor.js";
import { NodejsRestControllerDeclarativeProcessor } from "../../../../../../src/processors/scan/extract/nodejs/rest/controller-declarative-processor.js";
import { NodejsRestControllerFunctionalRouterProcessor } from "../../../../../../src/processors/scan/extract/nodejs/rest/controller-functional-router-processor.js";
import { NodejsRestControllerNextjsAppRouterProcessor } from "../../../../../../src/processors/scan/extract/nodejs/rest/controller-nextjs-app-router-processor.js";
import { ClientsToControllersLinksProcessor } from "../../../../../../src/processors/scan/transform/rest/clients-to-controllers-links-processor.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";

function writePackageJson(root: string, dependencies: Record<string, string>): void {
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "demo-api",
        version: "1.0.0",
        engines: { node: ">=20" },
        dependencies,
      },
      null,
      2,
    ),
  );
}

function createNpmStore(root: string, scanId: string): RunEntityStore {
  const repository = new Repository({
    url: "",
    localPath: root,
    name: "demo-api",
    namespace: "",
    buildSystems: ["npm"],
  });
  const module = new ApplicationModule({
    repositoryId: repository.id,
    buildSystem: "npm",
    groupId: "",
    artifactId: "demo-api",
    version: "1.0.0",
    name: "demo-api",
    repoPath: ".",
    buildScript: "package.json",
    isMultimodule: false,
    nodeVersion: ">=20",
  });

  const store = new RunEntityStore({
    sourceDirs: [root],
    scanId,
    runStartedAt: new Date("2026-09-04T12:00:00.000Z"),
  });
  store.addCreateIntents(
    "scan.scope",
    { groupId: "scan.scope", artifactId: "test" },
    { entities: { Repository: [repository] } },
  );
  store.addCreateIntents(
    "scan.extract",
    { groupId: "scan.extract.assembly.npm", artifactId: "test" },
    { entities: { ApplicationModule: [module] } },
  );

  return store;
}

describe("Nodejs REST scan processors", () => {
  it("discovers Express functional router controllers", () => {
    const root = createTestTempDir("c2a-nodejs-express-");
    writePackageJson(root, { express: "^4.18.0" });
    const srcDir = path.join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      path.join(srcDir, "routes.ts"),
      `import express from 'express';

export function registerUserRoutes(app: express.Application) {
  app.get('/users', (_req, res) => res.send('ok'));
  app.post('/users', async (_req, res) => res.send('created'));
}
`,
    );

    const store = createNpmStore(root, "scan-nodejs-express");
    const output = new NodejsRestControllerFunctionalRouterProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "registerUserRoutes");
    assert.equal(controllers[0]?.programmingModel, "FUNCTIONAL");
    assert.match(controllers[0]?.fqcn ?? "", /routes\.ts#registerUserRoutes$/);
    assert.deepEqual(controllers[0]?.endpoints, ["GET /users", "POST /users"]);
    assert.equal(controllers[0]?.tcpStackType, "NON_BLOCKING");
  });

  it("discovers NestJS declarative controllers", () => {
    const root = createTestTempDir("c2a-nodejs-nest-");
    writePackageJson(root, { "@nestjs/common": "^10.0.0" });
    const srcDir = path.join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      path.join(srcDir, "users.controller.ts"),
      `import { Controller, Get, Post } from '@nestjs/common';

@Controller('users')
export class UsersController {
  @Get()
  list(): string[] {
    return [];
  }

  @Post(':id')
  create(id: string): string {
    return id;
  }
}
`,
    );

    const store = createNpmStore(root, "scan-nodejs-nest");
    const output = new NodejsRestControllerDeclarativeProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.name, "UsersController");
    assert.equal(controllers[0]?.programmingModel, "DECLARATIVE");
    assert.match(controllers[0]?.fqcn ?? "", /users\.controller\.ts#UsersController$/);
    assert.deepEqual(controllers[0]?.endpoints, ["GET /users", "POST /users/:id"]);
  });

  it("discovers Next.js App Router route handlers", () => {
    const root = createTestTempDir("c2a-nodejs-next-");
    writePackageJson(root, { next: "^14.0.0" });
    const routeDir = path.join(root, "app", "api", "users", "[id]");
    mkdirSync(routeDir, { recursive: true });
    writeFileSync(
      path.join(routeDir, "route.ts"),
      `export async function GET() {
  return new Response('ok');
}

export function POST() {
  return new Response('created');
}
`,
    );

    const store = createNpmStore(root, "scan-nodejs-next");
    const output = new NodejsRestControllerNextjsAppRouterProcessor().process(store.snapshot());
    const controllers = output.entities?.RestController ?? [];

    assert.equal(controllers.length, 1);
    assert.equal(controllers[0]?.programmingModel, "CONVENTION_BASED");
    assert.match(controllers[0]?.fqcn ?? "", /route\.ts$/);
    assert.deepEqual(controllers[0]?.endpoints, ["GET /api/users/:id", "POST /api/users/:id"]);
  });

  it("discovers axios programmatic clients", () => {
    const root = createTestTempDir("c2a-nodejs-axios-");
    writePackageJson(root, { axios: "^1.6.0" });
    const srcDir = path.join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      path.join(srcDir, "user-client.ts"),
      `import axios from 'axios';

export async function fetchUsers() {
  await axios.get('/users');
  await axios.post('/users', { name: 'demo' });
}
`,
    );

    const store = createNpmStore(root, "scan-nodejs-axios");
    const output = new NodejsRestClientProgrammaticProcessor().process(store.snapshot());
    const clients = output.entities?.RestClient ?? [];

    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, "fetchUsers");
    assert.equal(clients[0]?.clientFramework, "axios");
    assert.match(clients[0]?.fqcn ?? "", /user-client\.ts#fetchUsers$/);
    assert.deepEqual(clients[0]?.endpoints, ["GET /users", "POST /users"]);
  });

  it("links RestControllers and RestClients by endpoint intersection across modules", () => {
    const root = createTestTempDir("c2a-nodejs-link-");
    writePackageJson(root, { express: "^4.18.0", axios: "^1.6.0", workspaces: ["packages/*"] });

    const serverDir = path.join(root, "packages", "server");
    const clientDir = path.join(root, "packages", "client");
    mkdirSync(path.join(serverDir, "src"), { recursive: true });
    mkdirSync(path.join(clientDir, "src"), { recursive: true });

    writeFileSync(
      path.join(serverDir, "package.json"),
      JSON.stringify({ name: "server", version: "1.0.0", dependencies: { express: "^4.18.0" } }),
    );
    writeFileSync(
      path.join(clientDir, "package.json"),
      JSON.stringify({ name: "client", version: "1.0.0", dependencies: { axios: "^1.6.0" } }),
    );

    writeFileSync(
      path.join(serverDir, "src", "routes.ts"),
      `import express from 'express';
export function routes(app: express.Application) {
  app.get('/orders', (_req, res) => res.send('ok'));
}
`,
    );
    writeFileSync(
      path.join(clientDir, "src", "client.ts"),
      `import axios from 'axios';
export async function loadOrders() {
  await axios.get('/orders');
}
`,
    );

    const repository = new Repository({
      url: "",
      localPath: root,
      name: "demo-api",
      namespace: "",
      buildSystems: ["npm"],
    });
    const serverModule = new ApplicationModule({
      repositoryId: repository.id,
      buildSystem: "npm",
      groupId: "",
      artifactId: "server",
      version: "1.0.0",
      name: "server",
      repoPath: "packages/server",
      buildScript: "packages/server/package.json",
      isMultimodule: true,
      nodeVersion: ">=20",
    });
    const clientModule = new ApplicationModule({
      repositoryId: repository.id,
      buildSystem: "npm",
      groupId: "",
      artifactId: "client",
      version: "1.0.0",
      name: "client",
      repoPath: "packages/client",
      buildScript: "packages/client/package.json",
      isMultimodule: true,
      nodeVersion: ">=20",
    });

    const store = new RunEntityStore({
      sourceDirs: [root],
      scanId: "scan-nodejs-link",
      runStartedAt: new Date("2026-09-04T12:00:00.000Z"),
    });
    store.addCreateIntents(
      "scan.scope",
      { groupId: "scan.scope", artifactId: "test" },
      { entities: { Repository: [repository] } },
    );
    store.addCreateIntents(
      "scan.extract",
      { groupId: "scan.extract.assembly.npm", artifactId: "test" },
      { entities: { ApplicationModule: [serverModule, clientModule] } },
    );

    store.addCreateIntents(
      "scan.extract",
      { groupId: "scan.extract.nodejs.rest", artifactId: "controller-functional-router" },
      new NodejsRestControllerFunctionalRouterProcessor().process(store.snapshot()),
    );
    store.addCreateIntents(
      "scan.extract",
      { groupId: "scan.extract.nodejs.rest", artifactId: "client-programmatic" },
      new NodejsRestClientProgrammaticProcessor().process(store.snapshot()),
    );

    const linkOutput = new ClientsToControllersLinksProcessor().process(store.snapshot());
    const links = linkOutput.links?.RestClientToControllerLink ?? [];

    assert.equal(links.length, 1);
    assert.equal(links[0]?.matchMethod, "ENDPOINT");
    assert.deepEqual(links[0]?.matchedValues, ["GET /orders"]);
  });
});
