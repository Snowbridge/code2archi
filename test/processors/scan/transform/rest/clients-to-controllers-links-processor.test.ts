import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCodeInventorySnapshot } from "../../../../../src/code-inventory/code-inventory-snapshot.js";
import { ApplicationModule } from "../../../../../src/code-inventory/entities/application-module.js";
import { HttpClientApi } from "../../../../../src/code-inventory/entities/http-client-api.js";
import { HttpServerApi } from "../../../../../src/code-inventory/entities/http-server-api.js";
import { toTypeReferenceFromQualifiedName } from "../../../../../src/code-inventory/entities/type-reference.js";
import { ClientsToControllersLinksProcessor } from "../../../../../src/processors/scan/transform/rest/clients-to-controllers-links-processor.js";

describe("ClientsToControllersLinksProcessor (scan)", () => {
  it("exposes scan.transform.rest coordinates", () => {
    const processor = new ClientsToControllersLinksProcessor();

    assert.deepEqual(processor.id, {
      groupId: "scan.transform.rest",
      artifactId: "clients-to-controllers-links",
    });
  });

  it("emits CONTRACT_TYPE, PAYLOAD_TYPE and ENDPOINT links for cross-module pairs", () => {
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

    const server = new HttpServerApi({
      applicationModuleId: serverModule.id,
      name: "LotsController",
      symbolKey: "com.example.LotsController",
      payloadTypes: [toTypeReferenceFromQualifiedName("com.example.LotDto")],
      endpoints: ["GET /api/lots", "GET /actuator/health"],
      concurrencyModel: "BLOCKING",
      bindingStyle: "ANNOTATION",
      contractTypes: [toTypeReferenceFromQualifiedName("com.example.LotsApi")],
      sourceFile: "LotsController.java",
    }).toCreateIntent();

    const client = new HttpClientApi({
      applicationModuleId: clientModule.id,
      name: "LotsClient",
      symbolKey: "com.example.LotsClient",
      payloadTypes: [toTypeReferenceFromQualifiedName("com.example.LotDto")],
      endpoints: ["GET /api/lots"],
      concurrencyModel: "BLOCKING",
      bindingStyle: "INTERFACE_MARKER",
      clientLibrary: "feign",
      inheritedContractTypes: [toTypeReferenceFromQualifiedName("com.example.LotsApi")],
      sourceFile: "LotsClient.java",
    }).toCreateIntent();

    const snapshot = buildCodeInventorySnapshot({
      scanId: "scan-1",
      sourceRoot: "/workspace",
      runStartedAt: new Date("2026-08-27T12:00:00.000Z"),
      entityArrays: {
        ApplicationModule: [serverModule, clientModule],
        HttpServerApi: [server],
        HttpClientApi: [client],
      },
      linkArrays: {},
    });

    const processor = new ClientsToControllersLinksProcessor();
    const output = processor.process(snapshot);

    const links = output.links?.HttpClientToServerApiLink ?? [];
    assert.equal(links.length, 3);
    assert.ok(links.some((link) => link.matchMethod === "CONTRACT_TYPE"));
    assert.ok(links.some((link) => link.matchMethod === "PAYLOAD_TYPE"));
    assert.ok(links.some((link) => link.matchMethod === "ENDPOINT"));
  });
});
