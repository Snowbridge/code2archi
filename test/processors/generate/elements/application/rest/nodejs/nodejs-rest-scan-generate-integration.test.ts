import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../../../../../../src/archimate-model/archi-model-store.js";
import { ApplicationComponent } from "../../../../../../../src/archimate-model/elements/archi-element.js";
import { MavenModuleProfile, RestClientProfile, RestControllerProfile } from "../../../../../../../src/archimate-model/profiles/profile.js";
import { buildDiscoveryModelSnapshot } from "../../../../../../../src/discovery-model/discovery-model-snapshot.js";
import { ApplicationModule } from "../../../../../../../src/discovery-model/entities/application-module.js";
import { Repository } from "../../../../../../../src/discovery-model/entities/repository.js";
import { RunEntityStore } from "../../../../../../../src/discovery-model/run-entity-store.js";
import { applicationComponentIdForModule } from "../../../../../../../src/generate/application-module-components.js";
import { nodejsRestControllerServiceLogicalId } from "../../../../../../../src/generate/nodejs-rest-controller-services.js";
import { nodejsRestClientServiceLogicalId } from "../../../../../../../src/generate/nodejs-rest-client-services.js";
import { NodejsControllersProcessor } from "../../../../../../../src/processors/generate/elements/application/rest/nodejs/nodejs-controllers-processor.js";
import { NodejsClientsAndDeclaredContractsProcessor } from "../../../../../../../src/processors/generate/elements/application/rest/nodejs/nodejs-clients-and-declared-contracts-processor.js";
import { NodejsDirectRestRequestsServingProcessor } from "../../../../../../../src/processors/generate/elements/application/rest/nodejs/nodejs-direct-rest-requests-serving-processor.js";
import { NodejsRestClientProgrammaticProcessor } from "../../../../../../../src/processors/scan/source/nodejs/rest/client-programmatic-processor.js";
import { NodejsRestControllerFunctionalRouterProcessor } from "../../../../../../../src/processors/scan/source/nodejs/rest/controller-functional-router-processor.js";
import { NodejsDirectRestRequestsServingProcessor as ScanNodejsDirectRestRequestsServingProcessor } from "../../../../../../../src/processors/scan/link/nodejs/direct-rest-requests-serving-processor.js";
import { createTestTempDir } from "../../../../../../test-temp-dir.js";
import { defaultGenerateProcessorOptions } from "../../../../../../generate/generate-processor-test-options.js";

function seedAppModuleComponent(
  store: ArchiModelStore,
  moduleId: string,
  moduleName: string,
): string {
  const applicationFolderId = store.getPredefinedFolderId("application");
  const componentId = applicationComponentIdForModule(moduleId);
  const profile = MavenModuleProfile.create();
  if (store.snapshot().findProfile(profile.name, profile.conceptType) === undefined) {
    store.registerProfile(profile);
  }
  if (store.snapshot().getElement(componentId) === undefined) {
    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements.application", artifactId: "app-components-from-modules" },
      {
        elements: [
          ApplicationComponent.withId(componentId)
            .name(moduleName)
            .inFolder(applicationFolderId)
            .profiles(profile.id)
            .build(),
        ],
      },
    );
  }
  return componentId;
}

describe("Nodejs REST scan → generate integration", () => {
  it("maps scanned Express controller and axios client into ArchiMate elements and serving link", () => {
    const root = createTestTempDir("c2a-nodejs-e2e-");
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "demo-api",
        version: "1.0.0",
        engines: { node: ">=20" },
        dependencies: { express: "^4.18.0", axios: "^1.6.0" },
        workspaces: ["packages/*"],
      }),
    );

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
      namespace: "demo",
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

    const entityStore = new RunEntityStore({
      sourceDirs: [root],
      scanId: "scan-nodejs-e2e",
      runStartedAt: new Date("2026-09-04T12:00:00.000Z"),
    });
    entityStore.addCreateIntents(
      "scan.scope",
      { groupId: "scan.scope", artifactId: "test" },
      { entities: { Repository: [repository] } },
    );
    entityStore.addCreateIntents(
      "scan.source",
      { groupId: "scan.source.assembly.npm", artifactId: "test" },
      { entities: { ApplicationModule: [serverModule, clientModule] } },
    );
    entityStore.addCreateIntents(
      "scan.source",
      { groupId: "scan.source.nodejs.rest", artifactId: "controller-functional-router" },
      new NodejsRestControllerFunctionalRouterProcessor().process(entityStore.snapshot()),
    );
    entityStore.addCreateIntents(
      "scan.source",
      { groupId: "scan.source.nodejs.rest", artifactId: "client-programmatic" },
      new NodejsRestClientProgrammaticProcessor().process(entityStore.snapshot()),
    );
    entityStore.addCreateIntents(
      "scan.link",
      { groupId: "scan.link.nodejs.rest", artifactId: "direct-rest-requests-serving" },
      new ScanNodejsDirectRestRequestsServingProcessor().process(entityStore.snapshot()),
    );

    const snapshot = entityStore.snapshot();
    const controllers = snapshot.listEntities("NodejsRestController");
    const clients = snapshot.listEntities("NodejsRestClient");
    const links = snapshot.listLinks("NodejsDirectRestRequestsServingMatch");

    assert.equal(controllers.length, 1);
    assert.equal(clients.length, 1);
    assert.equal(links.length, 1);

    const discovery = buildDiscoveryModelSnapshot({
      scanId: snapshot.scanId,
      sourceRoot: root,
      runStartedAt: snapshot.runStartedAt,
      entityArrays: {
        Repository: snapshot.listEntities("Repository"),
        ApplicationModule: snapshot.listEntities("ApplicationModule"),
        NodejsRestController: controllers,
        NodejsRestClient: clients,
      },
      linkArrays: {
        NodejsDirectRestRequestsServingMatch: links,
      },
    });

    const archiStore = new ArchiModelStore({ modelName: "test", modelId: "model-nodejs-e2e" });
    seedAppModuleComponent(archiStore, serverModule.id, "server");
    seedAppModuleComponent(archiStore, clientModule.id, "client");

    const controllerId = controllers[0]!.id;
    const clientId = clients[0]!.id;
    const generateInput = {
      discovery,
      archi: archiStore.snapshot(),
      options: defaultGenerateProcessorOptions,
    };

    archiStore.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements.application.rest.nodejs", artifactId: "nodejs-controllers" },
      new NodejsControllersProcessor().process(generateInput),
    );
    archiStore.addCreateIntents(
      "generate.elements",
      {
        groupId: "generate.elements.application.rest.nodejs",
        artifactId: "nodejs-clients-and-declared-contracts",
      },
      new NodejsClientsAndDeclaredContractsProcessor().process({
        ...generateInput,
        archi: archiStore.snapshot(),
      }),
    );
    const servingOutput = new NodejsDirectRestRequestsServingProcessor().process({
        ...generateInput,
        archi: archiStore.snapshot(),
      });
    archiStore.addCreateIntents(
      "generate.elements",
      {
        groupId: "generate.elements.application.rest.nodejs",
        artifactId: "nodejs-direct-rest-requests-serving",
      },
      servingOutput,
    );

    const archi = archiStore.snapshot();
    const controllerElement = archi.getElement(controllerId);
    const clientElement = archi.getElement(clientId);

    assert.equal(controllerElement?.conceptType, "ApplicationService");
    assert.equal(clientElement?.conceptType, "ApplicationService");
    assert.equal(
      controllerElement?.properties?.find((property) => property.key === "c2a:Id")?.value,
      nodejsRestControllerServiceLogicalId(controllerId),
    );
    assert.equal(
      clientElement?.properties?.find((property) => property.key === "c2a:Id")?.value,
      nodejsRestClientServiceLogicalId(clientId),
    );

    const controllerProfile = RestControllerProfile.create();
    const clientProfile = RestClientProfile.create();
    assert.deepEqual(controllerElement?.profileIds, [controllerProfile.id]);
    assert.deepEqual(clientElement?.profileIds, [clientProfile.id]);

    assert.equal(servingOutput.relations?.length, 1);
    assert.equal(servingOutput.relations?.[0]?.relationType, "ServingRelationship");
  });
});
