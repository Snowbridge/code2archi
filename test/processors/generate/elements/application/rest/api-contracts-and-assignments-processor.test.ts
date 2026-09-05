import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ArchiModelStore } from "../../../../../../src/archimate-model/archi-model-store.js";
import { ApplicationService } from "../../../../../../src/archimate-model/elements/archi-element.js";
import { RestApiContractProfile } from "../../../../../../src/archimate-model/profiles/profile.js";
import { buildDiscoveryModelSnapshot } from "../../../../../../src/discovery-model/discovery-model-snapshot.js";
import { ApplicationModule } from "../../../../../../src/discovery-model/entities/application-module.js";
import { Repository } from "../../../../../../src/discovery-model/entities/repository.js";
import { RestClient } from "../../../../../../src/discovery-model/entities/rest-client.js";
import { RestController } from "../../../../../../src/discovery-model/entities/rest-controller.js";
import { RestClientToControllerLink } from "../../../../../../src/discovery-model/links/rest-client-to-controller-link.js";
import {
  restApiContractAssignmentRelationshipId,
  restApiContractElementId,
  restApiContractLogicalId,
} from "../../../../../../src/generate/rest-api-contracts.js";
import { ApiContractsAndAssignmentsProcessor } from "../../../../../../src/processors/generate/elements/application/rest/api-contracts-and-assignments-processor.js";
import { defaultGenerateProcessorOptions } from "../../../../../generate/generate-processor-test-options.js";

describe("ApiContractsAndAssignmentsProcessor (generate)", () => {
  it("exposes generate.elements.application.rest coordinates", () => {
    const processor = new ApiContractsAndAssignmentsProcessor();

    assert.deepEqual(processor.id, {
      groupId: "generate.elements.application.rest",
      artifactId: "api-contracts-and-assignments",
    });
  });

  it("creates contract and assignments for controller and deduped client link", () => {
    const repository = new Repository({
      name: "demo",
      namespace: "com.example",
      path: "demo",
      vcs: "git",
    }).toCreateIntent();
    const serverModule = new ApplicationModule({
      repositoryId: repository.id,
      name: "server",
      groupId: "com.example",
      artifactId: "server",
      buildSystem: "maven",
      buildToolVersion: "3.9.0",
      repoPath: "server",
    }).toCreateIntent();
    const clientModule = new ApplicationModule({
      repositoryId: repository.id,
      name: "client",
      groupId: "com.example",
      artifactId: "client",
      buildSystem: "maven",
      buildToolVersion: "3.9.0",
      repoPath: "client",
    }).toCreateIntent();

    const controller = new RestController({
      applicationModuleId: serverModule.id,
      name: "LotsController",
      fqcn: "com.example.LotsController",
      dtoFqcn: ["com.example.LotDto"],
      endpoints: ["GET /api/lots"],
      tcpStackType: "BLOCKING",
      programmingModel: "DECLARATIVE",
      implementedInterfaceFqcn: ["com.example.LotsApi"],
      sourceFile: "LotsController.java",
    }).toCreateIntent();

    const restClient = new RestClient({
      applicationModuleId: clientModule.id,
      name: "LotsClient",
      fqcn: "com.example.LotsClient",
      dtoFqcn: ["com.example.LotDto"],
      endpoints: ["GET /api/lots"],
      tcpStackType: "BLOCKING",
      discoveryStyle: "DECLARATIVE",
      clientFramework: "feign",
      extendedInterfaceFqcn: ["com.example.LotsApi"],
      sourceFile: "LotsClient.java",
    }).toCreateIntent();

    const endpointLink = new RestClientToControllerLink({
      restControllerId: controller.id,
      restClientId: restClient.id,
      sourceApplicationModuleId: serverModule.id,
      targetApplicationModuleId: clientModule.id,
      matchMethod: "ENDPOINT",
      basis: "inference",
      confidence: 0.7,
    }).toCreateIntent();
    const dtoLink = new RestClientToControllerLink({
      restControllerId: controller.id,
      restClientId: restClient.id,
      sourceApplicationModuleId: serverModule.id,
      targetApplicationModuleId: clientModule.id,
      matchMethod: "DTO",
      basis: "inference",
      confidence: 0.4,
    }).toCreateIntent();

    const discovery = buildDiscoveryModelSnapshot({
      scanId: "scan-1",
      sourceRoot: "/workspace",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
      entityArrays: {
        Repository: [repository],
        ApplicationModule: [serverModule, clientModule],
        RestController: [controller],
        RestClient: [restClient],
      },
      linkArrays: {
        RestClientToControllerLink: [
          {
            ...endpointLink,
            transformProcessor: "scan.transform.rest:clients-to-controllers-links",
            transformSchema: "0.0.0",
            linkedAt: "2026-01-01T00:00:00+00:00",
          },
          {
            ...dtoLink,
            transformProcessor: "scan.transform.rest:clients-to-controllers-links",
            transformSchema: "0.0.0",
            linkedAt: "2026-01-01T00:00:00+00:00",
          },
        ],
      },
    });

    const store = new ArchiModelStore({ modelName: "test", modelId: "model-1" });
    const applicationFolderId = store.getPredefinedFolderId("application");
    const contractProfile = RestApiContractProfile.create();
    store.registerProfile(contractProfile);
    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements.application.rest", artifactId: "controllers" },
      {
        elements: [
          ApplicationService.withId(controller.id)
            .name("LotsController")
            .inFolder(applicationFolderId)
            .build(),
        ],
      },
    );
    store.addCreateIntents(
      "generate.elements",
      { groupId: "generate.elements.application.rest", artifactId: "clients" },
      {
        elements: [
          ApplicationService.withId(restClient.id).name("LotsClient").inFolder(applicationFolderId).build(),
        ],
      },
    );

    const output = new ApiContractsAndAssignmentsProcessor().process({
      discovery,
      archi: store.snapshot(),
      options: defaultGenerateProcessorOptions,
    });

    const contractId = restApiContractElementId(serverModule.id, controller.fqcn);
    assert.equal(output.elements?.length, 1);
    assert.equal(output.elements?.[0]?.id, contractId);
    assert.equal(
      output.elements?.[0]?.properties.find((property) => property.key === "c2a:Id")?.value,
      restApiContractLogicalId(serverModule.id, controller.fqcn),
    );
    assert.equal(output.elements?.[0]?.name, "LotsController API Contract");

    assert.equal(output.relations?.length, 2);
    const controllerAssignment = output.relations?.find(
      (relation) => relation.targetId === controller.id,
    );
    const clientAssignment = output.relations?.find((relation) => relation.targetId === restClient.id);
    assert.ok(controllerAssignment);
    assert.ok(clientAssignment);
    assert.equal(
      controllerAssignment?.id,
      restApiContractAssignmentRelationshipId(contractId, controller.id),
    );
    assert.equal(
      clientAssignment?.id,
      restApiContractAssignmentRelationshipId(contractId, restClient.id),
    );
    assert.equal(
      controllerAssignment?.properties.find((property) => property.key === "c2a:basis")?.value,
      "extract",
    );
    assert.equal(
      clientAssignment?.properties.find((property) => property.key === "c2a:basis")?.value,
      "inference",
    );
    assert.equal(
      clientAssignment?.properties.find((property) => property.key === "c2a:confidence")?.value,
      "0.7",
    );
  });
});
