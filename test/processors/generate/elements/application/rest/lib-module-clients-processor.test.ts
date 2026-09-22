import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../../../../../src/archimate-model/archi-model-store.js";
import { buildCodeInventorySnapshot } from "../../../../../../src/code-inventory/code-inventory-snapshot.js";
import { ApplicationModule } from "../../../../../../src/code-inventory/entities/application-module.js";
import { ApplicationModuleDependency } from "../../../../../../src/code-inventory/entities/application-module-dependency.js";
import { Repository } from "../../../../../../src/code-inventory/entities/repository.js";
import { RestClient } from "../../../../../../src/code-inventory/entities/rest-client.js";
import {
  appModuleRealizesRestClientId,
  restClientAppServiceId,
} from "../../../../../../src/generate/rest-controller-elements.js";
import { RestLibModuleClientsProcessor } from "../../../../../../src/processors/generate/elements/application/rest/lib-module-clients-processor.js";
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

function dependencyRecord(
  naturalKeys: ConstructorParameters<typeof ApplicationModuleDependency>[0],
): ReturnType<ApplicationModuleDependency["toCreateIntent"]> {
  return new ApplicationModuleDependency(naturalKeys).toCreateIntent();
}

function clientRecord(
  naturalKeys: ConstructorParameters<typeof RestClient>[0],
): ReturnType<RestClient["toCreateIntent"]> {
  return new RestClient(naturalKeys).toCreateIntent();
}

function discoverySnapshot(input: {
  repositories: ReturnType<typeof repositoryRecord>[];
  modules: ReturnType<typeof moduleRecord>[];
  dependencies?: ReturnType<typeof dependencyRecord>[];
  clients: ReturnType<typeof clientRecord>[];
}) {
  return buildCodeInventorySnapshot({
    scanId: "scan-1",
    sourceRoot: "/workspace",
    runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    entityArrays: {
      Repository: input.repositories,
      ApplicationModule: input.modules,
      ApplicationModuleDependency: input.dependencies ?? [],
      RestClient: input.clients,
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
  const libModule = moduleRecord({
    repositoryId: repository.id,
    buildSystem: "gradle",
    groupId: "com.example",
    artifactId: "demo-lib",
    version: "1",
    name: "demo-lib",
    repoPath: "demo-lib",
    buildScript: "demo-lib/build.gradle",
    isMultimodule: false,
  });
  const appModule = moduleRecord({
    repositoryId: repository.id,
    buildSystem: "gradle",
    groupId: "com.example",
    artifactId: "demo-app",
    version: "1",
    name: "demo-app",
    repoPath: "demo-app",
    buildScript: "demo-app/build.gradle",
    isMultimodule: false,
  });
  const dependency = dependencyRecord({
    parentId: appModule.id,
    groupId: libModule.groupId,
    artifactId: libModule.artifactId,
    version: "1",
  });
  return { repository, libModule, appModule, dependency };
}

function clientIn(moduleId: string, simpleName: string) {
  return clientRecord({
    applicationModuleId: moduleId,
    fqcn: `com.example.api.${simpleName}`,
    simpleName,
    fileName: `src/main/java/com/example/api/${simpleName}.java`,
    endpoints: ["GET /api/users"],
    contractIds: [],
    dataTypeIds: [],
  });
}

describe("RestLibModuleClientsProcessor", () => {
  it("exposes generate.elements.application.rest coordinates", () => {
    const processor = new RestLibModuleClientsProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.application.rest",
      artifactId: "lib-module-clients",
    });
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ALWAYS");
  });

  it("creates service and realization for clients in library modules only", () => {
    const { repository, libModule, appModule, dependency } = demoFixture();
    const libClient = clientIn(libModule.id, "LibUserClient");
    const appClient = clientIn(appModule.id, "AppUserClient");
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [libModule, appModule],
      dependencies: [dependency],
      clients: [libClient, appClient],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestLibModuleClientsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const serviceId = restClientAppServiceId(libClient.id);
    const service = output.elements?.find((element) => element.id === serviceId);

    assert.equal(output.elements?.length, 1);
    assert.equal(service?.conceptType, "ApplicationService");
    assert.equal(service?.name, "LibUserClient");
    assert.equal(propertyValue(service?.properties, "c2a:slot"), "rest-client-app-service");
    assert.equal(
      propertyValue(service?.properties, "c2a:generator"),
      "generate.elements.application.rest:lib-module-clients",
    );

    assert.equal(output.relations?.length, 1);
    assert.equal(output.relations?.[0]?.relationType, "RealizationRelationship");
    assert.equal(output.relations?.[0]?.id, appModuleRealizesRestClientId(libModule.id, libClient.id));
  });

  it("skips clients whose module cannot be resolved", () => {
    const { repository, libModule, dependency } = demoFixture();
    const client = clientIn("missing-module", "GhostClient");
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [libModule],
      dependencies: [dependency],
      clients: [client],
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new RestLibModuleClientsProcessor();
    const output = processor.process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements, undefined);
    assert.equal(output.relations, undefined);
  });
});
