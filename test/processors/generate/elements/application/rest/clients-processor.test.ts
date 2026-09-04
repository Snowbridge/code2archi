import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../../../../../src/archimate-model/archi-model-store.js";
import { ApplicationComponent } from "../../../../../../src/archimate-model/elements/archi-element.js";
import { MavenModuleProfile, RestClientProfile } from "../../../../../../src/archimate-model/profiles/profile.js";
import { buildDiscoveryModelSnapshot } from "../../../../../../src/discovery-model/discovery-model-snapshot.js";
import { ApplicationModule } from "../../../../../../src/discovery-model/entities/application-module.js";
import { Repository } from "../../../../../../src/discovery-model/entities/repository.js";
import { RestClient } from "../../../../../../src/discovery-model/entities/rest-client.js";
import { applicationComponentIdForModule } from "../../../../../../src/generate/application-module-components.js";
import {
  restClientRealizationRelationshipId,
  restClientServiceLogicalId,
} from "../../../../../../src/generate/rest-client-services.js";
import { ClientsProcessor } from "../../../../../../src/processors/generate/elements/application/rest/clients-processor.js";
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

function restClientRecord(
  naturalKeys: ConstructorParameters<typeof RestClient>[0],
): ReturnType<RestClient["toCreateIntent"]> {
  return new RestClient(naturalKeys).toCreateIntent();
}

function discoverySnapshot(
  repositories: ReturnType<typeof repositoryRecord>[],
  modules: ReturnType<typeof moduleRecord>[],
  clients: ReturnType<typeof restClientRecord>[],
) {
  return buildDiscoveryModelSnapshot({
    scanId: "scan-1",
    sourceRoot: "/workspace",
    runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
    entityArrays: {
      Repository: repositories,
      ApplicationModule: modules,
      RestClient: clients,
    },
  });
}

function seedAppModuleComponent(
  store: ArchiModelStore,
  module: ReturnType<typeof moduleRecord>,
): string {
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

function baseRepositoryAndModule() {
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
  return { repository, module };
}

describe("ClientsProcessor", () => {
  it("exposes generate.elements.application.rest coordinates", () => {
    const processor = new ClientsProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.application.rest",
      artifactId: "clients",
    });
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ALWAYS");
  });

  it("creates REST client and realization for Feign client", () => {
    const { repository, module } = baseRepositoryAndModule();
    const client = restClientRecord({
      applicationModuleId: module.id,
      name: "PaymentFeignClient",
      fqcn: "com.example.client.PaymentFeignClient",
      dtoFqcn: [],
      endpoints: ["GET /api/payments/{id}", "POST /api/payments"],
      tcpStackType: "BLOCKING",
      discoveryStyle: "DECLARATIVE",
      clientFramework: "feign",
      extendedInterfaceFqcn: ["com.example.api.PaymentApi"],
      sourceFile: "src/main/java/com/example/client/PaymentFeignClient.java",
      baseUrl: "${payment.url}",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const appComponentId = seedAppModuleComponent(store, module);

    const output = new ClientsProcessor().process({
      discovery: discoverySnapshot([repository], [module], [client]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const service = output.elements?.find((element) => element.id === client.id);
    assert.equal(service?.conceptType, "ApplicationService");
    assert.equal(service?.name, "PaymentFeignClient");
    assert.deepEqual(service?.profileIds, [RestClientProfile.create().id]);
    assert.equal(
      service?.properties?.find((property) => property.key === "c2a:slot")?.value,
      "rest-client",
    );
    assert.equal(
      service?.properties?.find((property) => property.key === "c2a:generator")?.value,
      "generate.elements.application.rest:clients",
    );
    assert.equal(
      service?.properties?.find((property) => property.key === "c2a:Id")?.value,
      restClientServiceLogicalId(client.id),
    );
    assert.equal(service?.documentation, "Endpoints:\n- GET /api/payments/{id}\n- POST /api/payments");

    const realization = output.relations?.find(
      (relation) => relation.relationType === "RealizationRelationship",
    );
    assert.equal(realization?.sourceId, appComponentId);
    assert.equal(realization?.targetId, client.id);
    assert.equal(realization?.id, restClientRealizationRelationshipId(appComponentId, client.id));
    assert.equal(output.elements?.filter((element) => element.conceptType === "ApplicationInterface").length, 0);
    assert.equal(
      output.relations?.filter((relation) => relation.relationType === "AssignmentRelationship").length,
      0,
    );
  });

  it("omits documentation when endpoints are empty", () => {
    const { repository, module } = baseRepositoryAndModule();
    const client = restClientRecord({
      applicationModuleId: module.id,
      name: "EmptyEndpointsClient",
      fqcn: "com.example.EmptyEndpointsClient",
      dtoFqcn: [],
      endpoints: [],
      tcpStackType: "BLOCKING",
      discoveryStyle: "PROGRAMMATIC",
      clientFramework: "webclient",
      extendedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/EmptyEndpointsClient.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedAppModuleComponent(store, module);

    const output = new ClientsProcessor().process({
      discovery: discoverySnapshot([repository], [module], [client]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const service = output.elements?.find((element) => element.id === client.id);
    assert.equal(service?.documentation, undefined);
  });

  it("creates rest-client without Realization when app-module-component is missing", () => {
    const { repository, module } = baseRepositoryAndModule();
    const client = restClientRecord({
      applicationModuleId: module.id,
      name: "PaymentFeignClient",
      fqcn: "com.example.client.PaymentFeignClient",
      dtoFqcn: [],
      endpoints: ["GET /api/payments/{id}"],
      tcpStackType: "BLOCKING",
      discoveryStyle: "DECLARATIVE",
      clientFramework: "feign",
      extendedInterfaceFqcn: ["com.example.api.PaymentApi"],
      sourceFile: "src/main/java/com/example/client/PaymentFeignClient.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const output = new ClientsProcessor().process({
      discovery: discoverySnapshot([repository], [module], [client]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length, 1);
    assert.equal(output.elements?.some((element) => element.id === client.id), true);
    assert.equal(
      (output.relations ?? []).some(
        (relation) =>
          relation.relationType === "RealizationRelationship" && relation.targetId === client.id,
      ),
      false,
    );
  });
});
