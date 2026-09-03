import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../../src/archimate-model/archi-model-store.js";
import {
  ApplicationComponent,
  ApplicationService,
} from "../../../src/archimate-model/elements/archi-element.js";
import {
  MavenModuleProfile,
  RestClientProfile,
  RestControllerProfile,
} from "../../../src/archimate-model/profiles/profile.js";
import { buildDiscoveryModelSnapshot } from "../../../src/discovery-model/discovery-model-snapshot.js";
import { ApplicationModule } from "../../../src/discovery-model/entities/application-module.js";
import { Repository } from "../../../src/discovery-model/entities/repository.js";
import { RestClient } from "../../../src/discovery-model/entities/rest-client.js";
import { applicationComponentIdForModule } from "../../../src/generate/application-module-components.js";
import {
  declaredContractAssignmentToClientId,
  declaredRestContractId,
  declaredRestContractLogicalId,
} from "../../../src/generate/declared-rest-contracts.js";
import {
  restClientRealizationRelationshipId,
  restClientServiceLogicalId,
} from "../../../src/generate/rest-client-services.js";
import { ClientsAndDeclaredContractsProcessor } from "../../../src/processors/generate.elements.application.rest/clients-and-declared-contracts-processor.js";
import { DeclaredApiContractsProcessor } from "../../../src/processors/generate.elements.application.rest/declared-api-contracts-processor.js";
import { defaultGenerateProcessorOptions } from "../../generate/generate-processor-test-options.js";

const API_FQCN = "com.example.api.PaymentApi";
const STUB_FQCN = "com.example.client.PaymentFeignClient";

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
      { groupId: "generate.elements.application", artifactId: "application-components-from-modules" },
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

describe("ClientsAndDeclaredContractsProcessor", () => {
  it("exposes generate.elements.application.rest coordinates", () => {
    const processor = new ClientsAndDeclaredContractsProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.application.rest",
      artifactId: "clients-and-declared-contracts",
    });
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ALWAYS");
  });

  it("creates REST client, realization, and declared contracts for Feign client", () => {
    const { repository, module } = baseRepositoryAndModule();
    const client = restClientRecord({
      applicationModuleId: module.id,
      name: "PaymentFeignClient",
      fqcn: STUB_FQCN,
      dtoFqcn: [],
      endpoints: ["GET /api/payments/{id}", "POST /api/payments"],
      tcpStackType: "BLOCKING",
      discoveryStyle: "DECLARATIVE",
      clientFramework: "feign",
      extendedInterfaceFqcn: [API_FQCN],
      sourceFile: "src/main/java/com/example/client/PaymentFeignClient.java",
      baseUrl: "${payment.url}",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const appComponentId = seedAppModuleComponent(store, module);

    const processor = new ClientsAndDeclaredContractsProcessor();
    const output = processor.process({
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
      service?.properties?.find((property) => property.key === "c2a:Id")?.value,
      restClientServiceLogicalId(client.id),
    );
    assert.equal(
      service?.properties?.find((property) => property.key === "c2a:tcpStackType")?.value,
      "BLOCKING",
    );
    assert.equal(
      service?.properties?.find((property) => property.key === "c2a:baseUrl")?.value,
      "${payment.url}",
    );
    assert.equal(service?.documentation, "Endpoints:\n- GET /api/payments/{id}\n- POST /api/payments");

    const realization = output.relations?.find(
      (relation) => relation.relationType === "RealizationRelationship",
    );
    assert.equal(realization?.sourceId, appComponentId);
    assert.equal(realization?.targetId, client.id);
    assert.equal(realization?.id, restClientRealizationRelationshipId(appComponentId, client.id));

    const contractElements =
      output.elements?.filter((element) => element.conceptType === "ApplicationInterface") ?? [];
    assert.equal(contractElements.length, 2);
    assert.ok(contractElements.some((element) => element.id === declaredRestContractId(API_FQCN)));
    assert.ok(contractElements.some((element) => element.id === declaredRestContractId(STUB_FQCN)));

    const assignments =
      output.relations?.filter((relation) => relation.relationType === "AssignmentRelationship") ??
      [];
    assert.equal(assignments.length, 2);
    assert.ok(
      assignments.some(
        (relation) =>
          relation.id === declaredContractAssignmentToClientId(
            declaredRestContractId(API_FQCN),
            client.id,
          ),
      ),
    );
  });

  it("creates one declared contract for programmatic client with fqcn only", () => {
    const { repository, module } = baseRepositoryAndModule();
    const client = restClientRecord({
      applicationModuleId: module.id,
      name: "ScoringServiceRestClient",
      fqcn: "com.example.ScoringServiceRestClient",
      dtoFqcn: [],
      endpoints: ["POST /scoring/check"],
      tcpStackType: "BLOCKING",
      discoveryStyle: "PROGRAMMATIC",
      clientFramework: "rest-template",
      extendedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/ScoringServiceRestClient.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedAppModuleComponent(store, module);

    const processor = new ClientsAndDeclaredContractsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [client]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const contractElements =
      output.elements?.filter((element) => element.conceptType === "ApplicationInterface") ?? [];
    assert.equal(contractElements.length, 1);
    assert.equal(contractElements[0]?.id, declaredRestContractId("com.example.ScoringServiceRestClient"));
    assert.equal(output.relations?.filter((relation) => relation.relationType === "AssignmentRelationship").length, 1);
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

    const processor = new ClientsAndDeclaredContractsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [client]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const service = output.elements?.find((element) => element.id === client.id);
    assert.equal(service?.documentation, undefined);
    assert.equal(
      service?.properties?.find((property) => property.key === "c2a:baseUrl"),
      undefined,
    );
  });

  it("skips when app-module-component is missing from archi snapshot", () => {
    const { repository, module } = baseRepositoryAndModule();
    const client = restClientRecord({
      applicationModuleId: module.id,
      name: "PaymentFeignClient",
      fqcn: STUB_FQCN,
      dtoFqcn: [],
      endpoints: ["GET /api/payments/{id}"],
      tcpStackType: "BLOCKING",
      discoveryStyle: "DECLARATIVE",
      clientFramework: "feign",
      extendedInterfaceFqcn: [API_FQCN],
      sourceFile: "src/main/java/com/example/client/PaymentFeignClient.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const processor = new ClientsAndDeclaredContractsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [client]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length ?? 0, 0);
    assert.equal(output.relations?.length ?? 0, 0);
  });

  it("coexists with declared-api-contracts for shared FQCN", () => {
    const { repository, module } = baseRepositoryAndModule();
    const client = restClientRecord({
      applicationModuleId: module.id,
      name: "PaymentFeignClient",
      fqcn: STUB_FQCN,
      dtoFqcn: [],
      endpoints: ["GET /api/payments/{id}"],
      tcpStackType: "BLOCKING",
      discoveryStyle: "DECLARATIVE",
      clientFramework: "feign",
      extendedInterfaceFqcn: [API_FQCN],
      sourceFile: "src/main/java/com/example/client/PaymentFeignClient.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedAppModuleComponent(store, module);

    const controllerProfile = RestControllerProfile.create();
    if (store.snapshot().findProfile(controllerProfile.name, controllerProfile.conceptType) === undefined) {
      store.registerProfile(controllerProfile);
    }
    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements.application.rest", artifactId: "controllers" },
      {
        elements: [
          ApplicationService.withId("controller-1")
            .name("PaymentController")
            .inFolder(store.getPredefinedFolderId("application"))
            .profiles(controllerProfile.id)
            .build(),
        ],
      },
    );

    const declaredProcessor = new DeclaredApiContractsProcessor();
    const declaredOutput = declaredProcessor.process({
      discovery: buildDiscoveryModelSnapshot({
        scanId: "scan-1",
        sourceRoot: "/workspace",
        runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
        entityArrays: {
          Repository: [repository],
          ApplicationModule: [module],
          RestController: [
            {
              id: "controller-1",
              applicationModuleId: module.id,
              name: "PaymentController",
              fqcn: "com.example.PaymentController",
              dtoFqcn: [],
              endpoints: ["GET /api/payments/{id}"],
              tcpStackType: "BLOCKING",
              programmingModel: "DECLARATIVE",
              implementedInterfaceFqcn: [API_FQCN],
              sourceFile: "src/main/java/com/example/PaymentController.java",
            },
          ],
        },
      }),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements.application.rest", artifactId: "declared-api-contracts" },
      declaredOutput,
    );

    const clientsProcessor = new ClientsAndDeclaredContractsProcessor();
    const clientsOutput = clientsProcessor.process({
      discovery: discoverySnapshot([repository], [module], [client]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const sharedContractId = declaredRestContractId(API_FQCN);
    const sharedContracts = [
      ...(declaredOutput.elements ?? []),
      ...(clientsOutput.elements ?? []),
    ].filter((element) => element.id === sharedContractId);
    assert.equal(sharedContracts.length, 1);
    assert.equal(
      store.snapshot().getElement(sharedContractId)?.properties?.find((property) => property.key === "c2a:Id")
        ?.value,
      declaredRestContractLogicalId(API_FQCN),
    );
    assert.ok(
      (clientsOutput.elements ?? []).some((element) => element.id === declaredRestContractId(STUB_FQCN)),
    );
    assert.ok((clientsOutput.elements ?? []).some((element) => element.id === client.id));
  });
});
