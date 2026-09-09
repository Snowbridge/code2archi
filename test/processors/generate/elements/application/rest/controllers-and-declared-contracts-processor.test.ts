import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../../../../../src/archimate-model/archi-model-store.js";
import { buildCodeInventorySnapshot } from "../../../../../../src/code-inventory/code-inventory-snapshot.js";
import { ApplicationModule } from "../../../../../../src/code-inventory/entities/application-module.js";
import { HttpApiContract } from "../../../../../../src/code-inventory/entities/http-api-contract.js";
import { Repository } from "../../../../../../src/code-inventory/entities/repository.js";
import { RestController } from "../../../../../../src/code-inventory/entities/rest-controller.js";
import {
  appModuleRealizesRestControllerId,
  httpApiContractInterfaceId,
  inferredRestApiContractInterfaceId,
  restApiContractAssignmentId,
  restControllerAppServiceId,
} from "../../../../../../src/generate/rest-controller-elements.js";
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

function controllerRecord(
  naturalKeys: ConstructorParameters<typeof RestController>[0],
): ReturnType<RestController["toCreateIntent"]> {
  return new RestController(naturalKeys).toCreateIntent();
}

function discoverySnapshot(
  repositories: ReturnType<typeof repositoryRecord>[],
  modules: ReturnType<typeof moduleRecord>[],
  controllers: ReturnType<typeof controllerRecord>[],
  contracts: ReturnType<typeof contractRecord>[] = [],
) {
  return buildCodeInventorySnapshot({
    scanId: "scan-1",
    sourceRoot: "/workspace",
    runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    entityArrays: {
      Repository: repositories,
      ApplicationModule: modules,
      RestController: controllers,
      HttpApiContract: contracts,
    },
  });
}

function propertyValue(
  properties: readonly { key: string; value: string }[] | undefined,
  key: string,
): string | undefined {
  return properties?.find((property) => property.key === key)?.value;
}

describe("RestControllersAndDeclaredContractsProcessor", () => {
  it("exposes generate.elements.application.rest coordinates", () => {
    const processor = new RestControllersAndDeclaredContractsProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.application.rest",
      artifactId: "controllers-and-declared-contracts",
    });
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ALWAYS");
  });

  it("creates ApplicationService, contract interface, and relations for extract path", () => {
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
      endpoints: ["GET /api/users", "GET /actuator/health"],
      contractIds: [contract.id],
      dataTypeIds: [],
    });
    const discovery = discoverySnapshot([repository], [module], [controller], [contract]);
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestControllersAndDeclaredContractsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const serviceId = restControllerAppServiceId(controller.id);
    const interfaceId = httpApiContractInterfaceId(contract.id);
    const service = output.elements?.find((element) => element.id === serviceId);
    const interfaceElement = output.elements?.find((element) => element.id === interfaceId);

    assert.equal(service?.conceptType, "ApplicationService");
    assert.equal(service?.name, "UserController");
    assert.equal(service?.documentation, undefined);
    assert.equal(propertyValue(service?.properties, "c2a:slot"), "rest-controller-app-service");
    assert.equal(propertyValue(service?.properties, "c2a:basis"), "extract");

    assert.equal(interfaceElement?.conceptType, "ApplicationInterface");
    assert.equal(interfaceElement?.name, "UserContract");
    assert.equal(propertyValue(interfaceElement?.properties, "c2a:basis"), "extract");

    assert.equal(output.relations?.length, 2);
    assert.deepEqual(
      output.relations?.map((relation) => relation.relationType).sort(),
      ["AssignmentRelationship", "RealizationRelationship"],
    );

    const realization = output.relations?.find(
      (relation) => relation.id === appModuleRealizesRestControllerId(module.id, controller.id),
    );
    assert.equal(realization?.relationType, "RealizationRelationship");

    const assignment = output.relations?.find(
      (relation) => relation.id === restApiContractAssignmentId(interfaceId, serviceId),
    );
    assert.equal(assignment?.relationType, "AssignmentRelationship");
    assert.equal(assignment?.sourceId, interfaceId);
    assert.equal(assignment?.targetId, serviceId);
    assert.equal(assignment?.profileIds?.length ?? 0, 0);
  });

  it("creates inferred contract when business endpoints exist without contractIds", () => {
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
    const controller = controllerRecord({
      applicationModuleId: module.id,
      fqcn: "com.example.api.ItemController",
      simpleName: "ItemController",
      fileName: "src/main/java/com/example/api/ItemController.java",
      endpoints: ["POST /api/items"],
      contractIds: [],
      dataTypeIds: [],
    });
    const discovery = discoverySnapshot([repository], [module], [controller]);
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestControllersAndDeclaredContractsProcessor();
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

  it("creates only service and realization for infra-only endpoints without contracts", () => {
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
    const controller = controllerRecord({
      applicationModuleId: module.id,
      fqcn: "com.example.api.HealthController",
      simpleName: "HealthController",
      fileName: "src/main/java/com/example/api/HealthController.java",
      endpoints: ["GET /actuator/health", "GET /"],
      contractIds: [],
      dataTypeIds: [],
    });
    const discovery = discoverySnapshot([repository], [module], [controller]);
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestControllersAndDeclaredContractsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length, 1);
    assert.equal(output.elements?.[0]?.conceptType, "ApplicationService");
    assert.equal(output.elements?.[0]?.documentation, undefined);
    assert.equal(output.relations?.length, 1);
    assert.equal(output.relations?.[0]?.relationType, "RealizationRelationship");
  });

  it("emits realization when app-module-component is missing from archi snapshot", () => {
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
    const controller = controllerRecord({
      applicationModuleId: module.id,
      fqcn: "com.example.api.UserController",
      simpleName: "UserController",
      fileName: "src/main/java/com/example/api/UserController.java",
      endpoints: ["GET /api/users"],
      contractIds: [],
      dataTypeIds: [],
    });
    const discovery = discoverySnapshot([repository], [module], [controller]);
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestControllersAndDeclaredContractsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const realization = output.relations?.find(
      (relation) => relation.relationType === "RealizationRelationship",
    );
    assert.notEqual(realization, undefined);
    assert.equal(
      realization?.id,
      appModuleRealizesRestControllerId(module.id, controller.id),
    );
  });
});
