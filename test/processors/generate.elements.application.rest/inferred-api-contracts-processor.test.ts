import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../../src/archimate-model/archi-model-store.js";
import { ApplicationService } from "../../../src/archimate-model/elements/archi-element.js";
import {
  ApiContractProfile,
  InferredApiContractProfile,
  RestControllerProfile,
} from "../../../src/archimate-model/profiles/profile.js";
import { buildDiscoveryModelSnapshot } from "../../../src/discovery-model/discovery-model-snapshot.js";
import { ApplicationModule } from "../../../src/discovery-model/entities/application-module.js";
import { Repository } from "../../../src/discovery-model/entities/repository.js";
import { RestController } from "../../../src/discovery-model/entities/rest-controller.js";
import {
  declaredContractAssignmentId,
  declaredRestContractId,
} from "../../../src/generate/declared-rest-contracts.js";
import {
  buildInferredContractDocumentation,
  inferredContractAssignmentId,
  inferredRestContractId,
  inferredRestContractLogicalId,
  isEligibleForInferredRestContract,
} from "../../../src/generate/inferred-rest-contracts.js";
import { DeclaredApiContractsProcessor } from "../../../src/processors/generate.elements.application.rest/declared-api-contracts-processor.js";
import { InferredApiContractsProcessor } from "../../../src/processors/generate.elements.application.rest/inferred-api-contracts-processor.js";
import {
  defaultGenerateProcessorOptions,
  undecoratedGenerateProcessorOptions,
} from "../../generate/generate-processor-test-options.js";

const API_FQCN = "com.example.api.LotsCrudApi";

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

function restControllerRecord(
  naturalKeys: ConstructorParameters<typeof RestController>[0],
): ReturnType<RestController["toCreateIntent"]> {
  return new RestController(naturalKeys).toCreateIntent();
}

function discoverySnapshot(
  repositories: ReturnType<typeof repositoryRecord>[],
  modules: ReturnType<typeof moduleRecord>[],
  controllers: ReturnType<typeof restControllerRecord>[],
) {
  return buildDiscoveryModelSnapshot({
    scanId: "scan-1",
    sourceRoot: "/workspace",
    runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    entityArrays: {
      Repository: repositories,
      ApplicationModule: modules,
      RestController: controllers,
    },
  });
}

function seedRestController(
  store: ArchiModelStore,
  controller: ReturnType<typeof restControllerRecord>,
): void {
  const applicationFolderId = store.getPredefinedFolderId("application");
  const profile = RestControllerProfile.create();
  if (store.snapshot().findProfile(profile.name, profile.conceptType) === undefined) {
    store.registerProfile(profile);
  }
  if (store.snapshot().getElement(controller.id) === undefined) {
    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements.application.rest", artifactId: "controllers" },
      {
        elements: [
          ApplicationService.withId(controller.id)
            .name(String(controller.name))
            .inFolder(applicationFolderId)
            .profiles(profile.id)
            .build(),
        ],
      },
    );
  }
}

describe("buildInferredContractDocumentation", () => {
  it("formats endpoints and DTOs with sorted sections", () => {
    const documentation = buildInferredContractDocumentation(
      ["POST /lots", "GET /lots"],
      ["com.example.BarDto", "com.example.FooDto"],
    );

    assert.equal(
      documentation,
      "Endpoints:\n- GET /lots\n- POST /lots\n\nDTOs:\n- com.example.BarDto\n- com.example.FooDto",
    );
  });

  it("omits empty sections", () => {
    assert.equal(
      buildInferredContractDocumentation(["GET /lots"], []),
      "Endpoints:\n- GET /lots",
    );
    assert.equal(
      buildInferredContractDocumentation([], ["com.example.FooDto"]),
      "DTOs:\n- com.example.FooDto",
    );
  });
});

describe("isEligibleForInferredRestContract", () => {
  it("rejects empty endpoints and dtoFqcn", () => {
    assert.equal(isEligibleForInferredRestContract([], []), false);
  });

  it("rejects root health endpoint without DTOs", () => {
    assert.equal(isEligibleForInferredRestContract(["GET /"], []), false);
  });

  it("accepts meaningful endpoints without DTOs", () => {
    assert.equal(isEligibleForInferredRestContract(["GET /lots"], []), true);
    assert.equal(isEligibleForInferredRestContract(["GET /", "GET /lots"], []), true);
  });

  it("accepts DTOs even with only GET / endpoint", () => {
    assert.equal(isEligibleForInferredRestContract(["GET /"], ["com.example.FooDto"]), true);
  });
});

describe("InferredApiContractsProcessor", () => {
  it("exposes generate.elements.application.rest coordinates", () => {
    const processor = new InferredApiContractsProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.application.rest",
      artifactId: "inferred-api-contracts",
    });
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ALWAYS");
  });

  it("creates ApplicationInterface and Assignment for endpoints", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["maven"],
    });
    const module = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const controller = restControllerRecord({
      applicationModuleId: module.id,
      name: "LotsCrudController",
      fqcn: "com.example.LotsCrudController",
      dtoFqcn: [],
      endpoints: ["GET /lots"],
      tcpStackType: "BLOCKING",
      programmingModel: "DECLARATIVE",
      implementedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/LotsCrudController.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedRestController(store, controller);

    const processor = new InferredApiContractsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [controller]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const contractId = inferredRestContractId(controller.fqcn);
    const contract = output.elements?.find((element) => element.id === contractId);
    assert.equal(contract?.conceptType, "ApplicationInterface");
    assert.equal(contract?.name, "LotsCrudController Inferred REST-controller");
    assert.deepEqual(contract?.profileIds, [InferredApiContractProfile.create().id]);
    assert.equal(contract?.documentation, "Endpoints:\n- GET /lots");
    assert.equal(
      contract?.properties?.find((property) => property.key === "c2a:slot")?.value,
      "inferred-rest-contract",
    );
    assert.equal(
      contract?.properties?.find((property) => property.key === "c2a:confidence")?.value,
      "inferred",
    );
    assert.equal(
      contract?.properties?.find((property) => property.key === "c2a:generator")?.value,
      "generate.elements.application.rest:inferred-api-contracts",
    );
    assert.equal(
      contract?.properties?.find((property) => property.key === "c2a:Id")?.value,
      inferredRestContractLogicalId(controller.fqcn),
    );

    const assignment = output.relations?.[0];
    assert.equal(assignment?.relationType, "AssignmentRelationship");
    assert.equal(assignment?.sourceId, contractId);
    assert.equal(assignment?.targetId, controller.id);
    assert.equal(assignment?.id, inferredContractAssignmentId(contractId, controller.id));
    assert.equal(assignment?.profileIds?.length ?? 0, 0);
    assert.equal(
      assignment?.properties?.find((property) => property.key === "c2a:slot")?.value,
      "inferred-contract-assigned-to-rest-controller",
    );
    assert.equal(
      assignment?.properties?.find((property) => property.key === "c2a:confidence")?.value,
      "inferred",
    );
  });

  it("creates inferred contract when only dtoFqcn is present", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["maven"],
    });
    const module = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const controller = restControllerRecord({
      applicationModuleId: module.id,
      name: "LotsCrudController",
      fqcn: "com.example.LotsCrudController",
      dtoFqcn: ["com.example.FooDto"],
      endpoints: [],
      tcpStackType: "BLOCKING",
      programmingModel: "DECLARATIVE",
      implementedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/LotsCrudController.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedRestController(store, controller);

    const processor = new InferredApiContractsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [controller]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length, 1);
    assert.equal(output.relations?.length, 1);
    assert.equal(output.elements?.[0]?.documentation, "DTOs:\n- com.example.FooDto");
  });

  it("skips when endpoints and dtoFqcn are both empty", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["maven"],
    });
    const module = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const controller = restControllerRecord({
      applicationModuleId: module.id,
      name: "LimitController",
      fqcn: "com.example.LimitController",
      dtoFqcn: [],
      endpoints: [],
      tcpStackType: "BLOCKING",
      programmingModel: "DECLARATIVE",
      implementedInterfaceFqcn: [API_FQCN],
      sourceFile: "src/main/java/com/example/LimitController.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedRestController(store, controller);

    const processor = new InferredApiContractsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [controller]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length ?? 0, 0);
    assert.equal(output.relations?.length ?? 0, 0);
  });

  it("skips when dtoFqcn is empty and endpoints is only GET /", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["maven"],
    });
    const module = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const controller = restControllerRecord({
      applicationModuleId: module.id,
      name: "HealthController",
      fqcn: "com.example.HealthController",
      dtoFqcn: [],
      endpoints: ["GET /"],
      tcpStackType: "BLOCKING",
      programmingModel: "DECLARATIVE",
      implementedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/HealthController.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedRestController(store, controller);

    const processor = new InferredApiContractsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [controller]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length ?? 0, 0);
    assert.equal(output.relations?.length ?? 0, 0);
  });

  it("skips when rest-controller is missing from archi snapshot", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["maven"],
    });
    const module = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const controller = restControllerRecord({
      applicationModuleId: module.id,
      name: "LotsCrudController",
      fqcn: "com.example.LotsCrudController",
      dtoFqcn: ["com.example.FooDto"],
      endpoints: ["GET /lots"],
      tcpStackType: "BLOCKING",
      programmingModel: "DECLARATIVE",
      implementedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/LotsCrudController.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new InferredApiContractsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [controller]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length ?? 0, 0);
    assert.equal(output.relations?.length ?? 0, 0);
  });

  it("leaves names undecorated when decorate is false", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["maven"],
    });
    const module = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const controller = restControllerRecord({
      applicationModuleId: module.id,
      name: "LotsCrudController",
      fqcn: "com.example.LotsCrudController",
      dtoFqcn: [],
      endpoints: ["GET /lots"],
      tcpStackType: "BLOCKING",
      programmingModel: "DECLARATIVE",
      implementedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/LotsCrudController.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedRestController(store, controller);

    const processor = new InferredApiContractsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [controller]),
      archi: store.snapshot(),
      options: undecoratedGenerateProcessorOptions,
    });

    assert.equal(output.elements?.[0]?.name, "LotsCrudController");
  });

  it("deduplicates interface and creates two assignments for shared fqcn across modules", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["maven"],
    });
    const moduleA = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc-a",
      version: "1",
      name: "svc-a",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const moduleB = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc-b",
      version: "1",
      name: "svc-b",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const sharedFqcn = "com.example.FormController";
    const controllerA = restControllerRecord({
      applicationModuleId: moduleA.id,
      name: "FormController",
      fqcn: sharedFqcn,
      dtoFqcn: [],
      endpoints: ["GET /form/task/:taskId"],
      tcpStackType: "BLOCKING",
      programmingModel: "DECLARATIVE",
      implementedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/FormController.java",
    });
    const controllerB = restControllerRecord({
      applicationModuleId: moduleB.id,
      name: "FormController",
      fqcn: sharedFqcn,
      dtoFqcn: [],
      endpoints: ["GET /form/task/:taskId"],
      tcpStackType: "BLOCKING",
      programmingModel: "DECLARATIVE",
      implementedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/FormController.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedRestController(store, controllerA);
    seedRestController(store, controllerB);

    const processor = new InferredApiContractsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot(
        [repository],
        [moduleA, moduleB],
        [controllerA, controllerB],
      ),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const contractId = inferredRestContractId(sharedFqcn);
    assert.equal(output.elements?.length, 1);
    assert.equal(output.elements?.[0]?.id, contractId);
    assert.equal(output.relations?.length, 2);
    const relationIds = new Set(output.relations?.map((relation) => relation.id));
    assert.ok(relationIds.has(inferredContractAssignmentId(contractId, controllerA.id)));
    assert.ok(relationIds.has(inferredContractAssignmentId(contractId, controllerB.id)));

    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements.application.rest", artifactId: "inferred-api-contracts" },
      output,
    );
    assert.equal(store.snapshot().getElement(contractId)?.conceptType, "ApplicationInterface");
  });

  it("coexists with declared-api-contracts for the same controller", () => {
    const repository = repositoryRecord({
      url: "",
      localPath: "/workspace/demo",
      name: "demo",
      namespace: "",
      buildSystems: ["maven"],
    });
    const module = moduleRecord({
      repositoryId: repository.id,
      buildSystem: "maven",
      groupId: "com.example",
      artifactId: "svc",
      version: "1",
      name: "svc",
      repoPath: ".",
      buildScript: "pom.xml",
      isMultimodule: false,
    });
    const controller = restControllerRecord({
      applicationModuleId: module.id,
      name: "LotsCrudController",
      fqcn: "com.example.LotsCrudController",
      dtoFqcn: ["com.example.FooDto"],
      endpoints: ["GET /lots"],
      tcpStackType: "BLOCKING",
      programmingModel: "DECLARATIVE",
      implementedInterfaceFqcn: [API_FQCN],
      sourceFile: "src/main/java/com/example/LotsCrudController.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedRestController(store, controller);

    const discovery = discoverySnapshot([repository], [module], [controller]);
    const archi = store.snapshot();

    const declaredOutput = new DeclaredApiContractsProcessor().process({
      discovery,
      archi,
      options: defaultGenerateProcessorOptions,
    });
    const inferredOutput = new InferredApiContractsProcessor().process({
      discovery,
      archi,
      options: defaultGenerateProcessorOptions,
    });

    const declaredContractId = declaredRestContractId(API_FQCN);
    const inferredContractId = inferredRestContractId(controller.fqcn);

    assert.equal(declaredOutput.elements?.length, 1);
    assert.equal(inferredOutput.elements?.length, 1);
    assert.notEqual(declaredContractId, inferredContractId);
    assert.deepEqual(declaredOutput.elements?.[0]?.profileIds, [ApiContractProfile.create().id]);
    assert.deepEqual(inferredOutput.elements?.[0]?.profileIds, [
      InferredApiContractProfile.create().id,
    ]);
    assert.equal(declaredOutput.relations?.length, 1);
    assert.equal(inferredOutput.relations?.length, 1);
    assert.equal(
      declaredOutput.relations?.[0]?.id,
      declaredContractAssignmentId(declaredContractId, controller.id),
    );
    assert.equal(
      inferredOutput.relations?.[0]?.id,
      inferredContractAssignmentId(inferredContractId, controller.id),
    );
  });
});
