import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../../../../../src/archimate-model/archi-model-store.js";
import { ApplicationComponent, ApplicationService } from "../../../../../../src/archimate-model/elements/archi-element.js";
import { MavenModuleProfile, RestControllerProfile } from "../../../../../../src/archimate-model/profiles/profile.js";
import { buildDiscoveryModelSnapshot } from "../../../../../../src/discovery-model/discovery-model-snapshot.js";
import { ApplicationModule } from "../../../../../../src/discovery-model/entities/application-module.js";
import { Repository } from "../../../../../../src/discovery-model/entities/repository.js";
import { RestController } from "../../../../../../src/discovery-model/entities/rest-controller.js";
import { applicationComponentIdForModule } from "../../../../../../src/generate/application-module-components.js";
import {
  restControllerRealizationRelationshipId,
  restControllerServiceLogicalId,
} from "../../../../../../src/generate/rest-controller-services.js";
import { initLogging } from "../../../../../../src/platform/logging/index.js";
import { ControllersProcessor } from "../../../../../../src/processors/generate/elements/application/rest/controllers-processor.js";
import { createTestTempDir } from "../../../../../test-temp-dir.js";
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

function seedAppModuleComponent(store: ArchiModelStore, module: ReturnType<typeof moduleRecord>): string {
  const applicationFolderId = store.getPredefinedFolderId("application");
  const componentId = applicationComponentIdForModule(module.id);
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
            .name(String(module.name))
            .inFolder(applicationFolderId)
            .profiles(profile.id)
            .build(),
        ],
      },
    );
  }
  return componentId;
}

describe("ControllersProcessor", () => {
  it("exposes generate.elements.application.rest coordinates", () => {
    const processor = new ControllersProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.application.rest",
      artifactId: "controllers",
    });
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ALWAYS");
  });

  it("creates ApplicationService and Realization for declarative and functional controllers", () => {
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
    const declarativeController = restControllerRecord({
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
    const functionalController = restControllerRecord({
      applicationModuleId: module.id,
      name: "routes",
      fqcn: "com.example.RouterConfig#routes",
      dtoFqcn: [],
      endpoints: ["GET /api"],
      tcpStackType: "NON_BLOCKING",
      programmingModel: "FUNCTIONAL",
      implementedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/RouterConfig.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const appComponentId = seedAppModuleComponent(store, module);

    const processor = new ControllersProcessor();
    const output = processor.process({
      discovery: discoverySnapshot(
        [repository],
        [module],
        [declarativeController, functionalController],
      ),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length, 2);
    assert.equal(output.relations?.length, 2);

    const declarativeService = output.elements?.find(
      (element) => element.id === declarativeController.id,
    );
    assert.equal(declarativeService?.conceptType, "ApplicationService");
    assert.equal(declarativeService?.name, "LimitController");
    assert.deepEqual(declarativeService?.profileIds, [RestControllerProfile.create().id]);
    assert.equal(
      declarativeService?.properties?.find((property) => property.key === "c2a:generator")?.value,
      "generate.elements.application.rest:controllers",
    );
    assert.equal(
      declarativeService?.properties?.find((property) => property.key === "c2a:Id")?.value,
      restControllerServiceLogicalId(declarativeController.id),
    );

    const realization = output.relations?.find(
      (relation) => relation.targetId === declarativeController.id,
    );
    assert.equal(realization?.relationType, "RealizationRelationship");
    assert.equal(realization?.sourceId, appComponentId);
    assert.equal(
      realization?.id,
      restControllerRealizationRelationshipId(appComponentId, declarativeController.id),
    );
  });

  it("skips controller and Realization when app-module-component is missing", () => {
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

    const processor = new ControllersProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [controller]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length ?? 0, 0);
    assert.equal(output.relations?.length ?? 0, 0);
  });

  it("skips element creation when controller already exists in archi snapshot", () => {
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
    const appComponentId = seedAppModuleComponent(store, module);
    const applicationFolderId = store.getPredefinedFolderId("application");
    const profile = RestControllerProfile.create();
    store.registerProfile(profile);
    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements.application.rest", artifactId: "controllers" },
      {
        elements: [
          ApplicationService.withId(controller.id)
            .name("existing")
            .inFolder(applicationFolderId)
            .profiles(profile.id)
            .build(),
        ],
      },
    );

    const processor = new ControllersProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [controller]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length ?? 0, 0);
    assert.equal(output.relations?.length, 1);
    assert.equal(output.relations?.[0]?.sourceId, appComponentId);
    assert.equal(output.relations?.[0]?.targetId, controller.id);
  });

  it("emits c2a-debug properties for RestController when DEBUG", () => {
    initLogging({
      logLevel: "DEBUG",
      verbose: false,
      logDirectory: createTestTempDir("c2a-controllers-debug-"),
    });

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
    seedAppModuleComponent(store, module);

    const processor = new ControllersProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [controller]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const properties = output.elements?.[0]?.properties ?? [];
    assert.equal(
      properties.find((property) => property.key === "c2a-debug:RestController:name")?.value,
      "LimitController",
    );
  });
});
