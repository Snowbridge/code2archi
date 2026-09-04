import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../../../../../src/archimate-model/archi-model-store.js";
import { ApplicationService } from "../../../../../../src/archimate-model/elements/archi-element.js";
import { ApiContractProfile, RestControllerProfile } from "../../../../../../src/archimate-model/profiles/profile.js";
import { buildDiscoveryModelSnapshot } from "../../../../../../src/discovery-model/discovery-model-snapshot.js";
import { ApplicationModule } from "../../../../../../src/discovery-model/entities/application-module.js";
import { Repository } from "../../../../../../src/discovery-model/entities/repository.js";
import { RestController } from "../../../../../../src/discovery-model/entities/rest-controller.js";
import {
  declaredContractAssignmentId,
  declaredRestContractId,
  declaredRestContractLogicalId,
} from "../../../../../../src/generate/declared-rest-contracts.js";
import { ControllersDeclaredApiContractsProcessor } from "../../../../../../src/processors/generate/elements/application/rest/controllers-declared-api-contracts-processor.js";
import {
  defaultGenerateProcessorOptions,
  undecoratedGenerateProcessorOptions,
} from "../../../../../generate/generate-processor-test-options.js";

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

describe("ControllersDeclaredApiContractsProcessor", () => {
  it("exposes generate.elements.application.rest coordinates", () => {
    const processor = new ControllersDeclaredApiContractsProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.application.rest",
      artifactId: "controllers-declared-api-contracts",
    });
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ALWAYS");
  });

  it("creates ApplicationInterface and Assignment for implemented interface", () => {
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
      implementedInterfaceFqcn: [API_FQCN],
      sourceFile: "src/main/java/com/example/LotsCrudController.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedRestController(store, controller);

    const processor = new ControllersDeclaredApiContractsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [controller]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const contractId = declaredRestContractId(API_FQCN);
    const contract = output.elements?.find((element) => element.id === contractId);
    assert.equal(contract?.conceptType, "ApplicationInterface");
    assert.equal(contract?.name, "LotsCrudApi API Contract");
    assert.deepEqual(contract?.profileIds, [ApiContractProfile.create().id]);
    assert.equal(
      contract?.properties?.find((property) => property.key === "c2a:slot")?.value,
      "declared-rest-contract",
    );
    assert.equal(
      contract?.properties?.find((property) => property.key === "c2a:confidence")?.value,
      "confirmed",
    );
    assert.equal(
      contract?.properties?.find((property) => property.key === "c2a:generator")?.value,
      "generate.elements.application.rest:controllers-declared-api-contracts",
    );
    assert.equal(
      contract?.properties?.find((property) => property.key === "c2a:Id")?.value,
      declaredRestContractLogicalId(API_FQCN),
    );

    const assignment = output.relations?.[0];
    assert.equal(assignment?.relationType, "AssignmentRelationship");
    assert.equal(assignment?.sourceId, contractId);
    assert.equal(assignment?.targetId, controller.id);
    assert.equal(assignment?.id, declaredContractAssignmentId(contractId, controller.id));
    assert.equal(
      assignment?.properties?.find((property) => property.key === "c2a:slot")?.value,
      "declared-contract-assigned-to-rest-controller",
    );
  });

  it("deduplicates interface and creates two assignments for shared FQCN", () => {
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
    const controllerA = restControllerRecord({
      applicationModuleId: module.id,
      name: "LotsCrudController",
      fqcn: "com.example.LotsCrudController",
      dtoFqcn: [],
      endpoints: ["GET /lots"],
      tcpStackType: "BLOCKING",
      programmingModel: "DECLARATIVE",
      implementedInterfaceFqcn: [API_FQCN],
      sourceFile: "src/main/java/com/example/LotsCrudController.java",
    });
    const controllerB = restControllerRecord({
      applicationModuleId: module.id,
      name: "LotsCrudControllerV2",
      fqcn: "com.example.LotsCrudControllerV2",
      dtoFqcn: [],
      endpoints: ["GET /lots/v2"],
      tcpStackType: "BLOCKING",
      programmingModel: "DECLARATIVE",
      implementedInterfaceFqcn: [API_FQCN],
      sourceFile: "src/main/java/com/example/LotsCrudControllerV2.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedRestController(store, controllerA);
    seedRestController(store, controllerB);

    const processor = new ControllersDeclaredApiContractsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [controllerA, controllerB]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length, 1);
    assert.equal(output.relations?.length, 2);
  });

  it("skips when implementedInterfaceFqcn is empty", () => {
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
      endpoints: ["GET /limits"],
      tcpStackType: "BLOCKING",
      programmingModel: "DECLARATIVE",
      implementedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/LimitController.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedRestController(store, controller);

    const processor = new ControllersDeclaredApiContractsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [controller]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length ?? 0, 0);
    assert.equal(output.relations?.length ?? 0, 0);
  });

  it("emits declared assignment when rest-controller is missing from archi snapshot", () => {
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
      implementedInterfaceFqcn: [API_FQCN],
      sourceFile: "src/main/java/com/example/LotsCrudController.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new ControllersDeclaredApiContractsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [controller]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length, 1);
    assert.equal(output.relations?.length, 1);
    assert.equal(output.relations?.[0]?.targetId, controller.id);
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
      implementedInterfaceFqcn: [API_FQCN],
      sourceFile: "src/main/java/com/example/LotsCrudController.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedRestController(store, controller);

    const processor = new ControllersDeclaredApiContractsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [controller]),
      archi: store.snapshot(),
      options: undecoratedGenerateProcessorOptions,
    });

    assert.equal(output.elements?.[0]?.name, "LotsCrudApi");
  });
});
