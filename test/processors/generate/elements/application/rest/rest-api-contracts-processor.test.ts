import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../../../../../src/archimate-model/archi-model-store.js";
import { buildCodeInventorySnapshot } from "../../../../../../src/code-inventory/code-inventory-snapshot.js";
import { ApplicationModule } from "../../../../../../src/code-inventory/entities/application-module.js";
import { HttpApiContract } from "../../../../../../src/code-inventory/entities/http-api-contract.js";
import { Repository } from "../../../../../../src/code-inventory/entities/repository.js";
import { RestClient } from "../../../../../../src/code-inventory/entities/rest-client.js";
import { RestController } from "../../../../../../src/code-inventory/entities/rest-controller.js";
import {
  httpApiContractInterfaceId,
  inferredRestApiContractInterfaceId,
  restApiContractAssignmentId,
  restClientAppServiceId,
  restControllerAppServiceId,
} from "../../../../../../src/generate/rest-controller-elements.js";
import { RestApiContractsProcessor } from "../../../../../../src/processors/generate/elements/application/rest/rest-api-contracts-processor.js";
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

function contractRecord(
  fqcn: string,
): ReturnType<HttpApiContract["toCreateIntent"]> {
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
  return { repository, module };
}

describe("RestApiContractsProcessor", () => {
  it("exposes generate.elements.application.rest coordinates with ON_DEMAND policy", () => {
    const processor = new RestApiContractsProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.application.rest",
      artifactId: "rest-api-contracts",
    });
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ON_DEMAND");
  });

  it("creates extract interface and assignment for controller declared contracts", () => {
    const { repository, module } = demoFixture();
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
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [module],
      controllers: [controller],
      contracts: [contract],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestApiContractsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const interfaceId = httpApiContractInterfaceId(contract.id);
    const serviceId = restControllerAppServiceId(controller.id);
    const interfaceElement = output.elements?.find((element) => element.id === interfaceId);

    assert.equal(output.elements?.length, 1);
    assert.equal(interfaceElement?.conceptType, "ApplicationInterface");
    assert.equal(interfaceElement?.name, "UserContract");
    assert.equal(propertyValue(interfaceElement?.properties, "c2a:basis"), "extract");
    assert.equal(propertyValue(interfaceElement?.properties, "c2a:slot"), "rest-api-contract-interface");
    assert.equal(
      propertyValue(interfaceElement?.properties, "c2a:generator"),
      "generate.elements.application.rest:rest-api-contracts",
    );

    assert.equal(output.relations?.length, 1);
    const assignment = output.relations?.[0];
    assert.equal(assignment?.id, restApiContractAssignmentId(interfaceId, serviceId));
    assert.equal(assignment?.relationType, "AssignmentRelationship");
    assert.equal(assignment?.sourceId, interfaceId);
    assert.equal(assignment?.targetId, serviceId);
    assert.equal(assignment?.profileIds?.length ?? 0, 0);
    assert.equal(propertyValue(assignment?.properties, "c2a:basis"), "extract");
  });

  it("creates inferred interface and assignment when business endpoints exist without contractIds", () => {
    const { repository, module } = demoFixture();
    const controller = controllerRecord({
      applicationModuleId: module.id,
      fqcn: "com.example.api.ItemController",
      simpleName: "ItemController",
      fileName: "src/main/java/com/example/api/ItemController.java",
      endpoints: ["POST /api/items", "GET /actuator/health"],
      contractIds: [],
      dataTypeIds: [],
    });
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [module],
      controllers: [controller],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestApiContractsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const interfaceId = inferredRestApiContractInterfaceId(controller.id);
    const interfaceElement = output.elements?.find((element) => element.id === interfaceId);

    assert.equal(interfaceElement?.name, "Inferred REST API (ItemController)");
    assert.equal(interfaceElement?.documentation, "POST /api/items");
    assert.equal(propertyValue(interfaceElement?.properties, "c2a:basis"), "inference");
    assert.equal(propertyValue(interfaceElement?.properties, "c2a:confidence"), "0.854321");

    const assignment = output.relations?.find(
      (relation) => relation.relationType === "AssignmentRelationship",
    );
    assert.equal(propertyValue(assignment?.properties, "c2a:basis"), "inference");
    assert.equal(propertyValue(assignment?.properties, "c2a:confidence"), "0.854321");
    assert.equal(assignment?.profileIds?.length ?? 0, 0);
  });

  it("creates nothing for infra-only endpoints without contracts", () => {
    const { repository, module } = demoFixture();
    const controller = controllerRecord({
      applicationModuleId: module.id,
      fqcn: "com.example.api.HealthController",
      simpleName: "HealthController",
      fileName: "src/main/java/com/example/api/HealthController.java",
      endpoints: ["GET /actuator/health", "GET /"],
      contractIds: [],
      dataTypeIds: [],
    });
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [module],
      controllers: [controller],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestApiContractsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements, undefined);
    assert.equal(output.relations, undefined);
  });

  it("shares one interface between controller and client and emits both assignments", () => {
    const { repository, module } = demoFixture();
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
      applicationModuleId: module.id,
      fqcn: "com.example.api.UserClient",
      simpleName: "UserClient",
      fileName: "src/main/java/com/example/api/UserClient.java",
      endpoints: ["GET /api/users"],
      contractIds: [contract.id],
      dataTypeIds: [],
    });
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [module],
      controllers: [controller],
      clients: [client],
      contracts: [contract],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestApiContractsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const interfaceId = httpApiContractInterfaceId(contract.id);
    const controllerServiceId = restControllerAppServiceId(controller.id);
    const clientServiceId = restClientAppServiceId(client.id);

    assert.equal(output.elements?.length, 1);
    assert.equal(output.elements?.[0]?.id, interfaceId);

    assert.equal(output.relations?.length, 2);
    assert.notEqual(
      output.relations?.find(
        (relation) => relation.id === restApiContractAssignmentId(interfaceId, controllerServiceId),
      ),
      undefined,
    );
    const clientAssignment = output.relations?.find(
      (relation) => relation.id === restApiContractAssignmentId(interfaceId, clientServiceId),
    );
    assert.equal(clientAssignment?.sourceId, interfaceId);
    assert.equal(clientAssignment?.targetId, clientServiceId);
    assert.equal(
      propertyValue(clientAssignment?.properties, "c2a:generator"),
      "generate.elements.application.rest:rest-api-contracts",
    );
  });

  it("emits client assignment by stable ids even when client service is absent from snapshot", () => {
    const { repository, module } = demoFixture();
    const contract = contractRecord("com.example.api.UserContract");
    const client = clientRecord({
      applicationModuleId: module.id,
      fqcn: "com.example.api.UserClient",
      simpleName: "UserClient",
      fileName: "src/main/java/com/example/api/UserClient.java",
      endpoints: [],
      contractIds: [contract.id],
      dataTypeIds: [],
    });
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [module],
      clients: [client],
      contracts: [contract],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestApiContractsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const interfaceId = httpApiContractInterfaceId(contract.id);
    const clientServiceId = restClientAppServiceId(client.id);

    const assignment = output.relations?.find(
      (relation) => relation.id === restApiContractAssignmentId(interfaceId, clientServiceId),
    );
    assert.notEqual(assignment, undefined);
    assert.equal(assignment?.targetId, clientServiceId);
  });

  it("creates nothing for clients without declared contracts", () => {
    const { repository, module } = demoFixture();
    const client = clientRecord({
      applicationModuleId: module.id,
      fqcn: "com.example.api.RawHttpClient",
      simpleName: "RawHttpClient",
      fileName: "src/main/java/com/example/api/RawHttpClient.java",
      endpoints: ["GET /api/items"],
      contractIds: [],
      dataTypeIds: [],
    });
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [module],
      clients: [client],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestApiContractsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements, undefined);
    assert.equal(output.relations, undefined);
  });
});
