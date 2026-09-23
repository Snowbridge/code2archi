import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../../../../../src/archimate-model/archi-model-store.js";
import { applicationComponentIdForModule } from "../../../../../../src/generate/application-module-components.js";
import { buildCodeInventorySnapshot } from "../../../../../../src/code-inventory/code-inventory-snapshot.js";
import { ApplicationModule } from "../../../../../../src/code-inventory/entities/application-module.js";
import { HttpApiContract } from "../../../../../../src/code-inventory/entities/http-api-contract.js";
import { Repository } from "../../../../../../src/code-inventory/entities/repository.js";
import { RestClient } from "../../../../../../src/code-inventory/entities/rest-client.js";
import { RestController } from "../../../../../../src/code-inventory/entities/rest-controller.js";
import {
  restClientAppServiceId,
  restControllerAppServiceId,
  restControllerServesAppComponentId,
  restControllerServesAppComponentLogicalId,
  restControllerServesRestClientId,
  restControllerServesRestClientLogicalId,
} from "../../../../../../src/generate/rest-controller-elements.js";
import { RestControllersServingRelationsProcessor } from "../../../../../../src/processors/generate/elements/application/rest/controllers-serving-relations-processor.js";
import { defaultGenerateProcessorOptions } from "../../../../../generate/generate-processor-test-options.js";

function repositoryRecord(
  naturalKeys: ConstructorParameters<typeof Repository>[0],
): ReturnType<Repository["toCreateIntent"]> {
  return new Repository(naturalKeys).toCreateIntent();
}

function moduleRecord(
  naturalKeys: ConstructorParameters<typeof ApplicationModule>[0],
): ReturnType<ApplicationModule["toCreateIntent"]> {
  return new ApplicationModule(naturalKeys).toCreateIntent();
}

function contractRecord(fqcn: string): ReturnType<HttpApiContract["toCreateIntent"]> {
  return new HttpApiContract({ fqcn }).toCreateIntent();
}

function controllerRecord(
  naturalKeys: ConstructorParameters<typeof RestController>[0],
): ReturnType<RestController["toCreateIntent"]> {
  return new RestController(naturalKeys).toCreateIntent();
}

function clientRecord(
  naturalKeys: ConstructorParameters<typeof RestClient>[0],
): ReturnType<RestClient["toCreateIntent"]> {
  return new RestClient(naturalKeys).toCreateIntent();
}

function discoverySnapshot(input: {
  repositories: ReturnType<typeof repositoryRecord>[];
  modules: ReturnType<typeof moduleRecord>[];
  controllers?: ReturnType<typeof controllerRecord>[];
  clients?: ReturnType<typeof clientRecord>[];
  contracts?: ReturnType<typeof contractRecord>[];
}) {
  return buildCodeInventorySnapshot({
    scanId: "scan-1",
    sourceRoot: "/workspace",
    runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    entityArrays: {
      Repository: input.repositories,
      ApplicationModule: input.modules,
      RestController: input.controllers ?? [],
      RestClient: input.clients ?? [],
      HttpApiContract: input.contracts ?? [],
    },
  });
}

function propertyValue(
  properties: readonly { key: string; value: string }[] | undefined,
  key: string,
): string | undefined {
  return properties?.find((property) => property.key === key)?.value;
}

function demoFixture() {
  const repository = repositoryRecord({
    url: "",
    localPath: "/workspace/demo",
    name: "demo",
    namespace: "com.example",
    buildSystems: ["gradle"],
  });
  const module = moduleRecord({
    repositoryId: repository.id,
    buildSystem: "gradle",
    groupId: "com.example",
    artifactId: "demo",
    version: "1",
    name: "demo",
    repoPath: "",
    buildScript: "build.gradle",
    isMultimodule: false,
  });
  const consumerModule = moduleRecord({
    repositoryId: repository.id,
    buildSystem: "gradle",
    groupId: "com.example",
    artifactId: "consumer",
    version: "1",
    name: "consumer",
    repoPath: "consumer",
    buildScript: "consumer/build.gradle",
    isMultimodule: false,
  });
  return { repository, module, consumerModule };
}

describe("RestControllersServingRelationsProcessor", () => {
  it("exposes generate.elements.application.rest coordinates with ALWAYS policy", () => {
    const processor = new RestControllersServingRelationsProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.application.rest",
      artifactId: "controllers-serving-relations",
    });
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ALWAYS");
  });

  it("emits both serving relations for a 1-1 pair with one shared contract", () => {
    const { repository, module, consumerModule } = demoFixture();
    const contract = contractRecord("com.example.api.UserContract");
    const controller = controllerRecord({
      applicationModuleId: module.id,
      fqcn: "com.example.api.UserController",
      simpleName: "UserController",
      fileName: "src/main/java/com/example/api/UserController.java",
      endpoints: ["GET /api/users"],
      contractIds: [contract.id],
      dataTypeIds: [],
    });
    const client = clientRecord({
      applicationModuleId: consumerModule.id,
      fqcn: "com.example.api.UserClient",
      simpleName: "UserClient",
      fileName: "src/main/java/com/example/api/UserClient.java",
      endpoints: ["GET /api/users"],
      contractIds: [contract.id],
      dataTypeIds: [],
      origin: "source",
    });
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [module, consumerModule],
      controllers: [controller],
      clients: [client],
      contracts: [contract],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestControllersServingRelationsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const controllerServiceId = restControllerAppServiceId(controller.id);
    const clientServiceId = restClientAppServiceId(client.id);
    const consumerComponentId = applicationComponentIdForModule(consumerModule.id);

    assert.equal(output.relations?.length, 2);

    const toClient = output.relations?.find(
      (relation) =>
        relation.id === restControllerServesRestClientId(controllerServiceId, clientServiceId),
    );
    assert.notEqual(toClient, undefined);
    assert.equal(toClient?.relationType, "ServingRelationship");
    assert.equal(toClient?.sourceId, controllerServiceId);
    assert.equal(toClient?.targetId, clientServiceId);
    assert.equal(toClient?.profileIds?.length, 1);
    assert.equal(
      propertyValue(toClient?.properties, "c2a:Id"),
      restControllerServesRestClientLogicalId(controller.id, client.id),
    );
    assert.equal(propertyValue(toClient?.properties, "c2a:basis"), "extract");
    assert.equal(
      propertyValue(toClient?.properties, "c2a:generator"),
      "generate.elements.application.rest:controllers-serving-relations",
    );
    assert.equal(
      propertyValue(toClient?.properties, "c2a:slot"),
      "rest-controller-serves-rest-client",
    );

    const toComponent = output.relations?.find(
      (relation) =>
        relation.id ===
        restControllerServesAppComponentId(controllerServiceId, consumerComponentId, contract.id),
    );
    assert.notEqual(toComponent, undefined);
    assert.equal(toComponent?.relationType, "ServingRelationship");
    assert.equal(toComponent?.sourceId, controllerServiceId);
    assert.equal(toComponent?.targetId, consumerComponentId);
    assert.equal(toComponent?.profileIds?.length, 1);
    assert.equal(
      propertyValue(toComponent?.properties, "c2a:Id"),
      restControllerServesAppComponentLogicalId(controller.id, contract.id, consumerModule.id),
    );
    assert.equal(
      propertyValue(toComponent?.properties, "c2a:slot"),
      "rest-controller-serves-app-component",
    );
  });

  it("emits two client servings but one component serving for two clients of one component", () => {
    const { repository, module, consumerModule } = demoFixture();
    const contract = contractRecord("com.example.api.UserContract");
    const controller = controllerRecord({
      applicationModuleId: module.id,
      fqcn: "com.example.api.UserController",
      simpleName: "UserController",
      fileName: "src/main/java/com/example/api/UserController.java",
      endpoints: ["GET /api/users"],
      contractIds: [contract.id],
      dataTypeIds: [],
    });
    const firstClient = clientRecord({
      applicationModuleId: consumerModule.id,
      fqcn: "com.example.api.FirstClient",
      simpleName: "FirstClient",
      fileName: "src/main/java/com/example/api/FirstClient.java",
      endpoints: [],
      contractIds: [contract.id],
      dataTypeIds: [],
      origin: "source",
    });
    const secondClient = clientRecord({
      applicationModuleId: consumerModule.id,
      fqcn: "com.example.api.SecondClient",
      simpleName: "SecondClient",
      fileName: "src/main/java/com/example/api/SecondClient.java",
      endpoints: [],
      contractIds: [contract.id],
      dataTypeIds: [],
      origin: "supplement",
    });
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [module, consumerModule],
      controllers: [controller],
      clients: [firstClient, secondClient],
      contracts: [contract],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestControllersServingRelationsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const clientServings = output.relations?.filter(
      (relation) =>
        propertyValue(relation.properties, "c2a:slot") === "rest-controller-serves-rest-client",
    );
    const componentServings = output.relations?.filter(
      (relation) =>
        propertyValue(relation.properties, "c2a:slot") === "rest-controller-serves-app-component",
    );

    assert.equal(clientServings?.length, 2);
    assert.equal(componentServings?.length, 1);
  });

  it("emits one client serving but two component servings for one client with two contracts", () => {
    const { repository, module, consumerModule } = demoFixture();
    const firstContract = contractRecord("com.example.api.FirstContract");
    const secondContract = contractRecord("com.example.api.SecondContract");
    const controller = controllerRecord({
      applicationModuleId: module.id,
      fqcn: "com.example.api.UserController",
      simpleName: "UserController",
      fileName: "src/main/java/com/example/api/UserController.java",
      endpoints: [],
      contractIds: [firstContract.id, secondContract.id],
      dataTypeIds: [],
    });
    const client = clientRecord({
      applicationModuleId: consumerModule.id,
      fqcn: "com.example.api.UserClient",
      simpleName: "UserClient",
      fileName: "src/main/java/com/example/api/UserClient.java",
      endpoints: [],
      contractIds: [firstContract.id, secondContract.id],
      dataTypeIds: [],
      origin: "source",
    });
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [module, consumerModule],
      controllers: [controller],
      clients: [client],
      contracts: [firstContract, secondContract],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestControllersServingRelationsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const clientServings = output.relations?.filter(
      (relation) =>
        propertyValue(relation.properties, "c2a:slot") === "rest-controller-serves-rest-client",
    );
    const componentServings = output.relations?.filter(
      (relation) =>
        propertyValue(relation.properties, "c2a:slot") === "rest-controller-serves-app-component",
    );

    assert.equal(clientServings?.length, 1);
    assert.equal(componentServings?.length, 2);
  });

  it("emits nothing without contract intersection", () => {
    const { repository, module, consumerModule } = demoFixture();
    const controllerContract = contractRecord("com.example.api.FirstContract");
    const clientContract = contractRecord("com.example.api.SecondContract");
    const controller = controllerRecord({
      applicationModuleId: module.id,
      fqcn: "com.example.api.UserController",
      simpleName: "UserController",
      fileName: "src/main/java/com/example/api/UserController.java",
      endpoints: ["GET /api/users"],
      contractIds: [controllerContract.id],
      dataTypeIds: [],
    });
    const client = clientRecord({
      applicationModuleId: consumerModule.id,
      fqcn: "com.example.api.UserClient",
      simpleName: "UserClient",
      fileName: "src/main/java/com/example/api/UserClient.java",
      endpoints: ["GET /api/users"],
      contractIds: [clientContract.id],
      dataTypeIds: [],
      origin: "source",
    });
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [module, consumerModule],
      controllers: [controller],
      clients: [client],
      contracts: [controllerContract, clientContract],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestControllersServingRelationsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.relations, undefined);
  });

  it("emits servings by stable ids even when peer services are absent from snapshot", () => {
    const { repository, module, consumerModule } = demoFixture();
    const contract = contractRecord("com.example.api.UserContract");
    const controller = controllerRecord({
      applicationModuleId: module.id,
      fqcn: "com.example.api.UserController",
      simpleName: "UserController",
      fileName: "src/main/java/com/example/api/UserController.java",
      endpoints: [],
      contractIds: [contract.id],
      dataTypeIds: [],
    });
    const client = clientRecord({
      applicationModuleId: consumerModule.id,
      fqcn: "com.example.api.UserClient",
      simpleName: "UserClient",
      fileName: "src/main/java/com/example/api/UserClient.java",
      endpoints: [],
      contractIds: [contract.id],
      dataTypeIds: [],
      origin: "source",
    });
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [module, consumerModule],
      controllers: [controller],
      clients: [client],
      contracts: [contract],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestControllersServingRelationsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const controllerServiceId = restControllerAppServiceId(controller.id);
    const clientServiceId = restClientAppServiceId(client.id);

    assert.equal(output.elements, undefined);
    assert.equal(output.relations?.length, 2);
    assert.notEqual(
      output.relations?.find(
        (relation) =>
          relation.id === restControllerServesRestClientId(controllerServiceId, clientServiceId),
      ),
      undefined,
    );
  });

  it("skips controllers and clients with unresolvable modules", () => {
    const { repository, module } = demoFixture();
    const contract = contractRecord("com.example.api.UserContract");
    const orphanController = controllerRecord({
      applicationModuleId: "missing-module",
      fqcn: "com.example.api.OrphanController",
      simpleName: "OrphanController",
      fileName: "src/main/java/com/example/api/OrphanController.java",
      endpoints: [],
      contractIds: [contract.id],
      dataTypeIds: [],
    });
    const orphanClient = clientRecord({
      applicationModuleId: "missing-module",
      fqcn: "com.example.api.OrphanClient",
      simpleName: "OrphanClient",
      fileName: "src/main/java/com/example/api/OrphanClient.java",
      endpoints: [],
      contractIds: [contract.id],
      dataTypeIds: [],
      origin: "source",
    });
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [module],
      controllers: [orphanController],
      clients: [orphanClient],
      contracts: [contract],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestControllersServingRelationsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.relations, undefined);
  });

  it("is deterministic across repeated runs", () => {
    const { repository, module, consumerModule } = demoFixture();
    const contract = contractRecord("com.example.api.UserContract");
    const controller = controllerRecord({
      applicationModuleId: module.id,
      fqcn: "com.example.api.UserController",
      simpleName: "UserController",
      fileName: "src/main/java/com/example/api/UserController.java",
      endpoints: [],
      contractIds: [contract.id],
      dataTypeIds: [],
    });
    const client = clientRecord({
      applicationModuleId: consumerModule.id,
      fqcn: "com.example.api.UserClient",
      simpleName: "UserClient",
      fileName: "src/main/java/com/example/api/UserClient.java",
      endpoints: [],
      contractIds: [contract.id],
      dataTypeIds: [],
      origin: "source",
    });
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [module, consumerModule],
      controllers: [controller],
      clients: [client],
      contracts: [contract],
    });

    const processor = new RestControllersServingRelationsProcessor();
    const first = processor.process({
      discovery,
      archi: new ArchiModelStore({ modelName: "test", modelId: "model-1" }).snapshot(),
      options: defaultGenerateProcessorOptions,
    });
    const second = processor.process({
      discovery,
      archi: new ArchiModelStore({ modelName: "test", modelId: "model-1" }).snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.deepEqual(second, first);
  });
});
