import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../../../../../src/archimate-model/archi-model-store.js";
import { ProvidesRestClientProfile } from "../../../../../../src/archimate-model/profiles/profile.js";
import { buildCodeInventorySnapshot } from "../../../../../../src/code-inventory/code-inventory-snapshot.js";
import { ApplicationModule } from "../../../../../../src/code-inventory/entities/application-module.js";
import { ApplicationModuleDependency } from "../../../../../../src/code-inventory/entities/application-module-dependency.js";
import { Repository } from "../../../../../../src/code-inventory/entities/repository.js";
import { RestClient } from "../../../../../../src/code-inventory/entities/rest-client.js";
import { applicationComponentIdForModule } from "../../../../../../src/generate/application-module-components.js";
import {
  appModuleRealizesRestClientId,
  libRestClientAggregationId,
  libRestClientAggregationLogicalId,
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

function demoRepository(name = "demo", localPath = "/workspace/demo") {
  return repositoryRecord({
    url: "",
    localPath,
    name,
    namespace: "com.example",
    buildSystems: ["gradle"],
  });
}

function gradleModule(
  repositoryId: string,
  artifactId: string,
  overrides: Partial<ConstructorParameters<typeof ApplicationModule>[0]> = {},
) {
  return moduleRecord({
    repositoryId,
    buildSystem: "gradle",
    groupId: "com.example",
    artifactId,
    version: "1",
    name: artifactId,
    repoPath: artifactId,
    buildScript: `${artifactId}/build.gradle`,
    isMultimodule: false,
    ...overrides,
  });
}

function demoFixture() {
  const repository = demoRepository();
  const libModule = gradleModule(repository.id, "demo-lib");
  const appModule = gradleModule(repository.id, "demo-app");
  const dependency = dependencyRecord({
    parentId: appModule.id,
    groupId: libModule.groupId,
    artifactId: libModule.artifactId,
    version: "1",
  });
  return { repository, libModule, appModule, dependency };
}

function clientIn(
  moduleId: string,
  simpleName: string,
  overrides: Partial<ConstructorParameters<typeof RestClient>[0]> = {},
) {
  return clientRecord({
    applicationModuleId: moduleId,
    fqcn: `com.example.api.${simpleName}`,
    simpleName,
    fileName: `src/main/java/com/example/api/${simpleName}.java`,
    endpoints: ["GET /api/users"],
    contractIds: [],
    dataTypeIds: [],
    ...overrides,
  });
}

function runProcessor(
  discovery: ReturnType<typeof discoverySnapshot>,
  store = new ArchiModelStore({ modelName: "test", modelId: "model-1" }),
) {
  return new RestLibModuleClientsProcessor().process({
    discovery,
    archi: store.snapshot(),
    options: defaultGenerateProcessorOptions,
  });
}

describe("RestLibModuleClientsProcessor", () => {
  it("exposes generate.elements.application.rest coordinates", () => {
    const processor = new RestLibModuleClientsProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.application.rest",
      artifactId: "lib-module-clients",
    });
    assert.equal(processor.version, "0.2.0");
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

    const output = runProcessor(discovery);

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

    const realization = output.relations?.find(
      (relation) => relation.relationType === "RealizationRelationship",
    );
    assert.ok(realization);
    assert.equal(realization.id, appModuleRealizesRestClientId(libModule.id, libClient.id));
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

    const output = runProcessor(discovery);

    assert.equal(output.elements, undefined);
    assert.equal(output.relations, undefined);
  });

  it("creates aggregation into each eligible consumer component", () => {
    const { repository, libModule, appModule, dependency } = demoFixture();
    const secondAppModule = gradleModule(repository.id, "demo-app-two");
    const secondDependency = dependencyRecord({
      parentId: secondAppModule.id,
      groupId: libModule.groupId,
      artifactId: libModule.artifactId,
      version: "1",
    });
    const libClient = clientIn(libModule.id, "LibUserClient");
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [libModule, appModule, secondAppModule],
      dependencies: [dependency, secondDependency],
      clients: [libClient],
    });

    const output = runProcessor(discovery);

    const aggregations = output.relations?.filter(
      (relation) => relation.relationType === "AggregationRelationship",
    );
    assert.equal(aggregations?.length, 2);

    const serviceId = restClientAppServiceId(libClient.id);
    for (const consumer of [appModule, secondAppModule]) {
      const aggregation = aggregations?.find(
        (relation) => relation.id === libRestClientAggregationId(consumer.id, libClient.id),
      );
      assert.ok(aggregation);
      assert.equal(aggregation.sourceId, applicationComponentIdForModule(consumer.id));
      assert.equal(aggregation.targetId, serviceId);
      assert.deepEqual(aggregation.profileIds, [ProvidesRestClientProfile.create().id]);
      assert.equal(
        propertyValue(aggregation.properties, "c2a:slot"),
        "lib-rest-client-aggregated-into-app-component",
      );
      assert.equal(
        propertyValue(aggregation.properties, "c2a:Id"),
        libRestClientAggregationLogicalId(consumer.id, libClient.id),
      );
      assert.equal(
        propertyValue(aggregation.properties, "c2a:generator"),
        "generate.elements.application.rest:lib-module-clients",
      );
    }

    const providesProfile = output.profiles?.find(
      (profile) => profile.id === ProvidesRestClientProfile.create().id,
    );
    assert.ok(providesProfile);
    assert.equal(providesProfile.name, "Utilises REST client from lib");
    assert.equal(providesProfile.conceptType, "AggregationRelationship");
  });

  it("deduplicates aggregation when a consumer declares several dependencies on the same lib", () => {
    const { repository, libModule, appModule, dependency } = demoFixture();
    const duplicateDependency = dependencyRecord({
      parentId: appModule.id,
      groupId: libModule.groupId,
      artifactId: libModule.artifactId,
      version: "2",
    });
    const libClient = clientIn(libModule.id, "LibUserClient");
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [libModule, appModule],
      dependencies: [dependency, duplicateDependency],
      clients: [libClient],
    });

    const output = runProcessor(discovery);

    const aggregations = output.relations?.filter(
      (relation) => relation.relationType === "AggregationRelationship",
    );
    assert.equal(aggregations?.length, 1);
    assert.equal(aggregations?.[0]?.id, libRestClientAggregationId(appModule.id, libClient.id));
  });

  it("does not create aggregation for supplemented clients", () => {
    const { repository, libModule, appModule, dependency } = demoFixture();
    const supplementedClient = clientIn(libModule.id, "SupplementedClient", {
      origin: "supplement",
    });
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [libModule, appModule],
      dependencies: [dependency],
      clients: [supplementedClient],
    });

    const output = runProcessor(discovery);

    assert.equal(output.elements?.length, 1);
    const relationTypes = output.relations?.map((relation) => relation.relationType) ?? [];
    assert.deepEqual(relationTypes, ["RealizationRelationship"]);
    assert.equal(
      output.relations?.[0]?.id,
      appModuleRealizesRestClientId(libModule.id, supplementedClient.id),
    );
  });

  it("skips aggregation for non-eligible consumer modules (multimodule parent)", () => {
    const repository = demoRepository();
    const libModule = gradleModule(repository.id, "demo-lib");
    const multimoduleParent = gradleModule(repository.id, "demo-parent", {
      isMultimodule: true,
    });
    const dependency = dependencyRecord({
      parentId: multimoduleParent.id,
      groupId: libModule.groupId,
      artifactId: libModule.artifactId,
      version: "1",
    });
    const libClient = clientIn(libModule.id, "LibUserClient");
    const discovery = discoverySnapshot({
      repositories: [repository],
      modules: [libModule, multimoduleParent],
      dependencies: [dependency],
      clients: [libClient],
    });

    const output = runProcessor(discovery);

    assert.equal(output.elements?.length, 1);
    const aggregations = output.relations?.filter(
      (relation) => relation.relationType === "AggregationRelationship",
    );
    assert.equal(aggregations?.length, 0);
  });

  it("resolves the lib module cross-repo for consumers from another repository", () => {
    const libRepository = demoRepository("lib-repo", "/workspace/lib-repo");
    const consumerRepository = demoRepository("consumer-repo", "/workspace/consumer-repo");
    const libModule = gradleModule(libRepository.id, "demo-lib");
    const consumerModule = gradleModule(consumerRepository.id, "demo-app");
    const dependency = dependencyRecord({
      parentId: consumerModule.id,
      groupId: libModule.groupId,
      artifactId: libModule.artifactId,
      version: "1",
    });
    const libClient = clientIn(libModule.id, "LibUserClient");
    const discovery = discoverySnapshot({
      repositories: [libRepository, consumerRepository],
      modules: [libModule, consumerModule],
      dependencies: [dependency],
      clients: [libClient],
    });

    const output = runProcessor(discovery);

    const aggregations = output.relations?.filter(
      (relation) => relation.relationType === "AggregationRelationship",
    );
    assert.equal(aggregations?.length, 1);
    assert.equal(aggregations?.[0]?.id, libRestClientAggregationId(consumerModule.id, libClient.id));
  });

  it("does not create aggregation when the dependency resolves to a different module with the same GAV", () => {
    const libRepository = demoRepository("lib-repo", "/workspace/lib-repo");
    const consumerRepository = demoRepository("consumer-repo", "/workspace/consumer-repo");
    const libModule = gradleModule(libRepository.id, "demo-lib");
    const sameGavModule = gradleModule(consumerRepository.id, "demo-lib-copy", {
      artifactId: "demo-lib",
    });
    const consumerModule = gradleModule(consumerRepository.id, "demo-app");
    const dependency = dependencyRecord({
      parentId: consumerModule.id,
      groupId: libModule.groupId,
      artifactId: libModule.artifactId,
      version: "1",
    });
    const libClient = clientIn(libModule.id, "LibUserClient");
    const discovery = discoverySnapshot({
      repositories: [libRepository, consumerRepository],
      modules: [libModule, sameGavModule, consumerModule],
      dependencies: [dependency],
      clients: [libClient],
    });

    const output = runProcessor(discovery);

    assert.equal(output.elements?.length, 1);
    const aggregations = output.relations?.filter(
      (relation) => relation.relationType === "AggregationRelationship",
    );
    assert.equal(aggregations?.length, 0);
  });
});
