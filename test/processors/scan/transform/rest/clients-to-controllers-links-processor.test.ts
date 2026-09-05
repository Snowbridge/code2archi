import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDiscoveryModelSnapshot } from "../../../../../src/discovery-model/discovery-model-snapshot.js";
import { ApplicationModule } from "../../../../../src/discovery-model/entities/application-module.js";
import { RestClient } from "../../../../../src/discovery-model/entities/rest-client.js";
import { RestController } from "../../../../../src/discovery-model/entities/rest-controller.js";
import { ClientsToControllersLinksProcessor } from "../../../../../src/processors/scan/transform/rest/clients-to-controllers-links-processor.js";

describe("ClientsToControllersLinksProcessor (scan)", () => {
  it("exposes scan.transform.rest coordinates", () => {
    const processor = new ClientsToControllersLinksProcessor();

    assert.deepEqual(processor.id, {
      groupId: "scan.transform.rest",
      artifactId: "clients-to-controllers-links",
    });
  });

  it("emits INTERFACE, DTO and ENDPOINT links for cross-module pairs", () => {
    const serverModule = new ApplicationModule({
      repositoryId: "repo-1",
      name: "server",
      groupId: "com.example",
      artifactId: "server",
      buildSystem: "maven",
      buildToolVersion: "3.9.0",
      repoPath: "server",
    }).toCreateIntent();
    const clientModule = new ApplicationModule({
      repositoryId: "repo-1",
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
      endpoints: ["GET /api/lots", "GET /actuator/health"],
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

    const snapshot = buildDiscoveryModelSnapshot({
      scanId: "scan-1",
      sourceRoot: "/workspace",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
      entityArrays: {
        ApplicationModule: [serverModule, clientModule],
        RestController: [controller],
        RestClient: [restClient],
      },
    });

    const output = new ClientsToControllersLinksProcessor().process(snapshot);
    const links = output.links?.RestClientToControllerLink ?? [];

    assert.equal(links.length, 3);
    assert.deepEqual(
      [...new Set(links.map((link) => link.matchMethod))].sort(),
      ["DTO", "ENDPOINT", "INTERFACE"],
    );
  });
});
