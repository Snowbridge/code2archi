import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GENERATE_ELEMENTS_GROUP_ID } from "../../../../../../src/cli/processor-groups.js";
import { ArchiModelStore } from "../../../../../../src/archimate-model/archi-model-store.js";
import { buildCodeInventorySnapshot } from "../../../../../../src/code-inventory/code-inventory-snapshot.js";
import { ApplicationModule } from "../../../../../../src/code-inventory/entities/application-module.js";
import { HttpApiContract } from "../../../../../../src/code-inventory/entities/http-api-contract.js";
import { Repository } from "../../../../../../src/code-inventory/entities/repository.js";
import { RestClient } from "../../../../../../src/code-inventory/entities/rest-client.js";
import { RestController } from "../../../../../../src/code-inventory/entities/rest-controller.js";
import {
  appModuleRealizesRestClientId,
  httpApiContractInterfaceId,
  restApiContractAssignmentId,
  restClientAppServiceId,
} from "../../../../../../src/generate/rest-controller-elements.js";
import { RestClientsAndDeclaredContractsProcessor } from "../../../../../../src/processors/generate/elements/application/rest/clients-and-declared-contracts-processor.js";
import { RestControllersAndDeclaredContractsProcessor } from "../../../../../../src/processors/generate/elements/application/rest/controllers-and-declared-contracts-processor.js";
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

function clientRecord(
  naturalKeys: ConstructorParameters<typeof RestClient>[0],
): ReturnType<RestClient["toCreateIntent"]> {
  return new RestClient(naturalKeys).toCreateIntent();
}

function controllerRecord(
  naturalKeys: ConstructorParameters<typeof RestController>[0],
): ReturnType<RestController["toCreateIntent"]> {
  return new RestController(naturalKeys).toCreateIntent();
}

function discoverySnapshot(input: {
  repositories: ReturnType<typeof repositoryRecord>[];
  modules: ReturnType<typeof moduleRecord>[];
  clients?: ReturnType<typeof clientRecord>[];
  controllers?: ReturnType<typeof controllerRecord>[];
  contracts?: ReturnType<typeof contractRecord>[];
}) {
  return buildCodeInventorySnapshot({
    scanId: "scan-1",
    sourceRoot: "/workspace",
    runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    entityArrays: {
      Repository: input.repositories,
      ApplicationModule: input.modules,
      RestClient: input.clients ?? [],
      RestController: input.controllers ?? [],
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

describe("RestClientsAndDeclaredContractsProcessor", () => {
  it("exposes generate.elements.application.rest coordinates", () => {
    const processor = new RestClientsAndDeclaredContractsProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.application.rest",
      artifactId: "clients-and-declared-contracts",
    });
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ALWAYS");
  });

  it("creates ApplicationService, contract interface, and relations for declared contracts", () => {
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
    const contract = contractRecord("com.example.api.UserContract");
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
      clients: [client],
      contracts: [contract],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestClientsAndDeclaredContractsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const serviceId = restClientAppServiceId(client.id);
    const interfaceId = httpApiContractInterfaceId(contract.id);
    const service = output.elements?.find((element) => element.id === serviceId);
    const interfaceElement = output.elements?.find((element) => element.id === interfaceId);

    assert.equal(service?.conceptType, "ApplicationService");
    assert.equal(service?.name, "UserClient");
    assert.equal(propertyValue(service?.properties, "c2a:slot"), "rest-client-app-service");
    assert.equal(propertyValue(service?.properties, "c2a:basis"), "extract");

    assert.equal(interfaceElement?.conceptType, "ApplicationInterface");
    assert.equal(interfaceElement?.name, "UserContract");

    assert.equal(output.relations?.length, 2);
    assert.deepEqual(
      output.relations?.map((relation) => relation.relationType).sort(),
      ["AssignmentRelationship", "RealizationRelationship"],
    );

    const assignment = output.relations?.find(
      (relation) => relation.id === restApiContractAssignmentId(interfaceId, serviceId),
    );
    assert.equal(assignment?.relationType, "AssignmentRelationship");
    assert.equal(assignment?.profileIds?.length ?? 0, 0);
  });

  it("creates only service and realization when contractIds is empty", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
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

    const processor = new RestClientsAndDeclaredContractsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length, 1);
    assert.equal(output.elements?.[0]?.conceptType, "ApplicationService");
    assert.equal(output.relations?.length, 1);
    assert.equal(output.relations?.[0]?.relationType, "RealizationRelationship");
    assert.equal(
      output.relations?.[0]?.id,
      appModuleRealizesRestClientId(module.id, client.id),
    );
  });

  it("reuses contract interface from controller processor and adds client assignment only", () => {
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

    const controllerProcessor = new RestControllersAndDeclaredContractsProcessor();
    const controllerOutput = controllerProcessor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });
    store.addCreateIntents(
      GENERATE_ELEMENTS_GROUP_ID,
      controllerProcessor.id,
      controllerOutput,
    );

    const clientProcessor = new RestClientsAndDeclaredContractsProcessor();
    const clientOutput = clientProcessor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const interfaceId = httpApiContractInterfaceId(contract.id);
    const clientServiceId = restClientAppServiceId(client.id);

    assert.equal(
      clientOutput.elements?.filter((element) => element.id === interfaceId).length ?? 0,
      0,
    );
    assert.equal(
      clientOutput.elements?.find((element) => element.id === clientServiceId)?.name,
      "UserClient",
    );

    const assignment = clientOutput.relations?.find(
      (relation) => relation.id === restApiContractAssignmentId(interfaceId, clientServiceId),
    );
    assert.equal(assignment?.relationType, "AssignmentRelationship");
    assert.equal(assignment?.sourceId, interfaceId);
    assert.equal(assignment?.targetId, clientServiceId);
  });
});
