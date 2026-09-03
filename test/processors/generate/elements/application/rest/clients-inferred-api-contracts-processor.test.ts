import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../../../../../src/archimate-model/archi-model-store.js";
import {
  ApplicationComponent,
  ApplicationService,
} from "../../../../../../src/archimate-model/elements/archi-element.js";
import {
  InferredApiContractProfile,
  MavenModuleProfile,
  RestClientProfile,
} from "../../../../../../src/archimate-model/profiles/profile.js";
import { buildDiscoveryModelSnapshot } from "../../../../../../src/discovery-model/discovery-model-snapshot.js";
import { ApplicationModule } from "../../../../../../src/discovery-model/entities/application-module.js";
import { Repository } from "../../../../../../src/discovery-model/entities/repository.js";
import { RestClient } from "../../../../../../src/discovery-model/entities/rest-client.js";
import { RestController } from "../../../../../../src/discovery-model/entities/rest-controller.js";
import { applicationComponentIdForModule } from "../../../../../../src/generate/application-module-components.js";
import {
  buildInferredContractDocumentation,
  inferredContractAssignmentToClientId,
  inferredRestContractId,
  inferredRestContractLogicalId,
  isEligibleForInferredRestContract,
} from "../../../../../../src/generate/inferred-rest-contracts.js";
import { ClientsAndDeclaredContractsProcessor } from "../../../../../../src/processors/generate/elements/application/rest/clients-and-declared-contracts-processor.js";
import { ClientsInferredApiContractsProcessor } from "../../../../../../src/processors/generate/elements/application/rest/clients-inferred-api-contracts-processor.js";
import { ControllersInferredApiContractsProcessor } from "../../../../../../src/processors/generate/elements/application/rest/controllers-inferred-api-contracts-processor.js";
import {
  defaultGenerateProcessorOptions,
  undecoratedGenerateProcessorOptions,
} from "../../../../../generate/generate-processor-test-options.js";

const API_FQCN = "com.example.api.PaymentApi";

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

function seedRestClient(
  store: ArchiModelStore,
  client: ReturnType<typeof restClientRecord>,
): void {
  const applicationFolderId = store.getPredefinedFolderId("application");
  const profile = RestClientProfile.create();
  if (store.snapshot().findProfile(profile.name, profile.conceptType) === undefined) {
    store.registerProfile(profile);
  }
  if (store.snapshot().getElement(client.id) === undefined) {
    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements.application.rest", artifactId: "clients-and-declared-contracts" },
      {
        elements: [
          ApplicationService.withId(client.id)
            .name(String(client.name))
            .inFolder(applicationFolderId)
            .profiles(profile.id)
            .build(),
        ],
      },
    );
  }
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

describe("ClientsInferredApiContractsProcessor", () => {
  it("exposes generate.elements.application.rest coordinates", () => {
    const processor = new ClientsInferredApiContractsProcessor();
    assert.equal(processor.id.groupId, "generate.elements.application.rest");
    assert.equal(processor.id.artifactId, "clients-inferred-api-contracts");
    assert.equal(processor.version, "0.1.0");
    assert.equal(processor.executionPolicy, "ALWAYS");
  });

  it("creates ApplicationInterface and Assignment for endpoints", () => {
    const { repository, module } = baseRepositoryAndModule();
    const client = restClientRecord({
      applicationModuleId: module.id,
      name: "PaymentFeignClient",
      fqcn: "com.example.client.PaymentFeignClient",
      dtoFqcn: [],
      endpoints: ["GET /payments"],
      tcpStackType: "BLOCKING",
      discoveryStyle: "DECLARATIVE",
      clientFramework: "feign",
      extendedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/client/PaymentFeignClient.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedRestClient(store, client);

    const processor = new ClientsInferredApiContractsProcessor();
    const output = processor.process({
      discovery: discoverySnapshot([repository], [module], [client]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const contractId = inferredRestContractId(client.fqcn);
    const contract = output.elements?.find((element) => element.id === contractId);
    assert.equal(contract?.conceptType, "ApplicationInterface");
    assert.equal(contract?.name, "PaymentFeignClient Inferred REST Contract");
    assert.deepEqual(contract?.profileIds, [InferredApiContractProfile.create().id]);
    assert.equal(contract?.documentation, "Endpoints:\n- GET /payments");
    assert.equal(
      contract?.properties?.find((property) => property.key === "c2a:slot")?.value,
      "inferred-rest-contract",
    );
    assert.equal(
      contract?.properties?.find((property) => property.key === "c2a:generator")?.value,
      "generate.elements.application.rest:clients-inferred-api-contracts",
    );
    assert.equal(
      contract?.properties?.find((property) => property.key === "c2a:Id")?.value,
      inferredRestContractLogicalId(client.fqcn),
    );

    const assignment = output.relations?.[0];
    assert.equal(assignment?.relationType, "AssignmentRelationship");
    assert.equal(assignment?.sourceId, contractId);
    assert.equal(assignment?.targetId, client.id);
    assert.equal(assignment?.id, inferredContractAssignmentToClientId(contractId, client.id));
    assert.equal(
      assignment?.properties?.find((property) => property.key === "c2a:slot")?.value,
      "inferred-contract-assigned-to-rest-client",
    );
  });

  it("skips when extendedInterfaceFqcn is not empty", () => {
    const { repository, module } = baseRepositoryAndModule();
    const client = restClientRecord({
      applicationModuleId: module.id,
      name: "PaymentFeignClient",
      fqcn: "com.example.client.PaymentFeignClient",
      dtoFqcn: [],
      endpoints: ["GET /payments"],
      tcpStackType: "BLOCKING",
      discoveryStyle: "DECLARATIVE",
      clientFramework: "feign",
      extendedInterfaceFqcn: [API_FQCN],
      sourceFile: "src/main/java/com/example/client/PaymentFeignClient.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedRestClient(store, client);

    const output = new ClientsInferredApiContractsProcessor().process({
      discovery: discoverySnapshot([repository], [module], [client]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length ?? 0, 0);
    assert.equal(output.relations?.length ?? 0, 0);
  });

  it("skips when endpoints and dtoFqcn are both empty", () => {
    const { repository, module } = baseRepositoryAndModule();
    const client = restClientRecord({
      applicationModuleId: module.id,
      name: "PaymentFeignClient",
      fqcn: "com.example.client.PaymentFeignClient",
      dtoFqcn: [],
      endpoints: [],
      tcpStackType: "BLOCKING",
      discoveryStyle: "PROGRAMMATIC",
      clientFramework: "webclient",
      extendedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/client/PaymentClient.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedRestClient(store, client);

    const output = new ClientsInferredApiContractsProcessor().process({
      discovery: discoverySnapshot([repository], [module], [client]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length ?? 0, 0);
    assert.equal(output.relations?.length ?? 0, 0);
  });

  it("emits contract and assignment when rest-client is missing from archi snapshot", () => {
    const { repository, module } = baseRepositoryAndModule();
    const client = restClientRecord({
      applicationModuleId: module.id,
      name: "PaymentFeignClient",
      fqcn: "com.example.client.PaymentFeignClient",
      dtoFqcn: [],
      endpoints: ["GET /payments"],
      tcpStackType: "BLOCKING",
      discoveryStyle: "DECLARATIVE",
      clientFramework: "feign",
      extendedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/client/PaymentFeignClient.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });

    const output = new ClientsInferredApiContractsProcessor().process({
      discovery: discoverySnapshot([repository], [module], [client]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    assert.equal(output.elements?.length, 1);
    assert.equal(output.relations?.length, 1);
    assert.equal(output.relations?.[0]?.targetId, client.id);
  });

  it("validateForWrite succeeds when inferred runs before clients-and-declared-contracts", () => {
    const { repository, module } = baseRepositoryAndModule();
    const client = restClientRecord({
      applicationModuleId: module.id,
      name: "PaymentFeignClient",
      fqcn: "com.example.client.PaymentFeignClient",
      dtoFqcn: [],
      endpoints: ["GET /payments"],
      tcpStackType: "BLOCKING",
      discoveryStyle: "DECLARATIVE",
      clientFramework: "feign",
      extendedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/client/PaymentFeignClient.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedAppModuleComponent(store, module);
    const discovery = discoverySnapshot([repository], [module], [client]);

    const inferredOutput = new ClientsInferredApiContractsProcessor().process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });
    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements.application.rest", artifactId: "clients-inferred-api-contracts" },
      inferredOutput,
    );

    const clientsOutput = new ClientsAndDeclaredContractsProcessor().process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });
    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements.application.rest", artifactId: "clients-and-declared-contracts" },
      clientsOutput,
    );

    assert.doesNotThrow(() => store.validateForWrite());
  });

  it("deduplicates interface when controller inferred created contract first", () => {
    const { repository, module } = baseRepositoryAndModule();
    const sharedFqcn = "com.example.SharedApi";
    const controller = new RestController({
      applicationModuleId: module.id,
      name: "SharedApiController",
      fqcn: sharedFqcn,
      dtoFqcn: [],
      endpoints: ["GET /shared"],
      tcpStackType: "BLOCKING",
      programmingModel: "DECLARATIVE",
      implementedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/SharedApiController.java",
    }).toCreateIntent();
    const client = restClientRecord({
      applicationModuleId: module.id,
      name: "SharedApiClient",
      fqcn: sharedFqcn,
      dtoFqcn: [],
      endpoints: ["GET /shared"],
      tcpStackType: "BLOCKING",
      discoveryStyle: "DECLARATIVE",
      clientFramework: "feign",
      extendedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/SharedApiClient.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedRestClient(store, client);

    const controllerDiscovery = buildDiscoveryModelSnapshot({
      scanId: "scan-1",
      sourceRoot: "/workspace",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
      entityArrays: {
        Repository: [repository],
        ApplicationModule: [module],
        RestController: [controller],
      },
    });

    const controllerInferred = new ControllersInferredApiContractsProcessor().process({
      discovery: controllerDiscovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });
    store.addCreateIntents(
      "generate.elements",
      {
        groupId: "generate.elements.application.rest",
        artifactId: "controllers-inferred-api-contracts",
      },
      controllerInferred,
    );

    const clientInferred = new ClientsInferredApiContractsProcessor().process({
      discovery: discoverySnapshot([repository], [module], [client]),
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const contractId = inferredRestContractId(sharedFqcn);
    assert.equal(controllerInferred.elements?.length, 1);
    assert.equal(clientInferred.elements?.length ?? 0, 0);
    assert.equal(clientInferred.relations?.length, 1);
    assert.equal(clientInferred.relations?.[0]?.sourceId, contractId);
  });

  it("leaves names undecorated when decorate is false", () => {
    const { repository, module } = baseRepositoryAndModule();
    const client = restClientRecord({
      applicationModuleId: module.id,
      name: "PaymentFeignClient",
      fqcn: "com.example.client.PaymentFeignClient",
      dtoFqcn: [],
      endpoints: ["GET /payments"],
      tcpStackType: "BLOCKING",
      discoveryStyle: "DECLARATIVE",
      clientFramework: "feign",
      extendedInterfaceFqcn: [],
      sourceFile: "src/main/java/com/example/client/PaymentFeignClient.java",
    });
    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    seedRestClient(store, client);

    const output = new ClientsInferredApiContractsProcessor().process({
      discovery: discoverySnapshot([repository], [module], [client]),
      archi: store.snapshot(),
      options: undecoratedGenerateProcessorOptions,
    });

    assert.equal(output.elements?.[0]?.name, "PaymentFeignClient");
  });
});

describe("buildInferredContractDocumentation (shared)", () => {
  it("reuses eligibility helper for client endpoints", () => {
    assert.equal(isEligibleForInferredRestContract(["GET /lots"], []), true);
    assert.equal(
      buildInferredContractDocumentation(["GET /lots"], []),
      "Endpoints:\n- GET /lots",
    );
  });
});
