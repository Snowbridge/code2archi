import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCodeInventorySnapshot } from "../../../../../src/code-inventory/code-inventory-snapshot.js";
import { HttpApiContract } from "../../../../../src/code-inventory/entities/http-api-contract.js";
import { InferredHttpApiContractsProcessor } from "../../../../../src/processors/scan/transform/rest/inferred-http-api-contracts-processor.js";

const processor = new InferredHttpApiContractsProcessor();

function controllerRecord(input: {
  id: string;
  fqcn: string;
  endpoints: string[];
  dataTypeIds: string[];
}): Record<string, unknown> {
  return {
    id: input.id,
    simpleName: "Ctrl",
    fqcn: input.fqcn,
    applicationModuleId: "mod-1",
    fileName: "src/Ctrl.java",
    endpoints: input.endpoints,
    dataTypeIds: input.dataTypeIds,
    extractProcessor: "scan.extract:test",
    extractSchema: "0.0.0",
    extractedAt: "2026-01-01T00:00:00+00:00",
  };
}

function clientRecord(input: {
  id: string;
  fqcn: string;
  endpoints: string[];
  dataTypeIds: string[];
}): Record<string, unknown> {
  return {
    id: input.id,
    simpleName: "Client",
    fqcn: input.fqcn,
    applicationModuleId: "mod-2",
    fileName: "src/Client.java",
    endpoints: input.endpoints,
    dataTypeIds: input.dataTypeIds,
    origin: "source",
    extractProcessor: "scan.extract:test",
    extractSchema: "0.0.0",
    extractedAt: "2026-01-01T00:00:00+00:00",
  };
}

describe("InferredHttpApiContractsProcessor", () => {
  it("creates inferred contract and client assignment", () => {
    const controllerId = "ctrl-1";
    const clientId = "client-1";
    const discovery = buildCodeInventorySnapshot({
      scanId: "scan-1",
      sourceRoot: "/repo",
      sourceDirs: ["/repo"],
      repositoryCommonRoot: "/repo",
      runStartedAt: new Date("2026-01-01T00:00:00Z"),
      entityMaps: new Map([
        [
          "RestController",
          new Map([[controllerId, controllerRecord({
            id: controllerId,
            fqcn: "com.example.ApiController",
            endpoints: ["GET /items"],
            dataTypeIds: [],
          })]]),
        ],
        [
          "RestClient",
          new Map([[clientId, clientRecord({
            id: clientId,
            fqcn: "com.example.ApiClient",
            endpoints: ["GET /items"],
            dataTypeIds: [],
          })]]),
        ],
      ]),
    });

    const output = processor.process(discovery);

    const inferredFqcn = HttpApiContract.inferredFqcnForController("com.example.ApiController");
    const contract = output.entities?.HttpApiContract?.find(
      (item) => item.fqcn === inferredFqcn,
    );
    assert.ok(contract);
    assert.equal(contract?.basis, "inference");
    assert.equal(contract?.confidence, 1);

    const clientLink = output.links?.HttpApiContractAssignment?.find(
      (link) => link.assigneeId === clientId,
    );
    assert.ok(clientLink);
    assert.equal(clientLink?.contractId, contract?.id);
    assert.equal(clientLink?.confidence, 1);
  });
});
