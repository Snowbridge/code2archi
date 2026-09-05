import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RestClientRecord } from "../../../../../src/discovery-model/entities/rest-client.js";
import type { RestControllerRecord } from "../../../../../src/discovery-model/entities/rest-controller.js";
import {
  collectRestClientToControllerLinks,
  matchRestClientControllerLinkCandidates,
} from "../../../../../src/processors/scan/transform/rest/rest-client-controller-link-match.js";

function controller(
  overrides: Partial<RestControllerRecord> & Pick<RestControllerRecord, "id" | "applicationModuleId">,
): RestControllerRecord {
  return {
    name: "Controller",
    fqcn: "com.example.Controller",
    dtoFqcn: [],
    endpoints: [],
    tcpStackType: "BLOCKING",
    programmingModel: "DECLARATIVE",
    implementedInterfaceFqcn: [],
    sourceFile: "Controller.java",
    extractProcessor: "scan.extract:test",
    extractSchema: "0.0.0",
    extractedAt: "2026-01-01T00:00:00+00:00",
    ...overrides,
  };
}

function client(
  overrides: Partial<RestClientRecord> & Pick<RestClientRecord, "id" | "applicationModuleId">,
): RestClientRecord {
  return {
    name: "Client",
    fqcn: "com.example.Client",
    dtoFqcn: [],
    endpoints: [],
    tcpStackType: "BLOCKING",
    discoveryStyle: "DECLARATIVE",
    clientFramework: "feign",
    extendedInterfaceFqcn: [],
    sourceFile: "Client.java",
    extractProcessor: "scan.extract:test",
    extractSchema: "0.0.0",
    extractedAt: "2026-01-01T00:00:00+00:00",
    ...overrides,
  };
}

describe("rest-client-controller-link-match", () => {
  it("skips matches within the same application module", () => {
    const matches = matchRestClientControllerLinkCandidates(
      controller({
        id: "ctrl-1",
        applicationModuleId: "mod-a",
        implementedInterfaceFqcn: ["com.example.Api"],
      }),
      client({
        id: "client-1",
        applicationModuleId: "mod-a",
        extendedInterfaceFqcn: ["com.example.Api"],
      }),
    );

    assert.deepEqual(matches, []);
  });

  it("creates confirmed INTERFACE match with score 1", () => {
    const matches = matchRestClientControllerLinkCandidates(
      controller({
        id: "ctrl-1",
        applicationModuleId: "mod-server",
        implementedInterfaceFqcn: ["com.example.Api", "com.example.Other"],
      }),
      client({
        id: "client-1",
        applicationModuleId: "mod-client",
        extendedInterfaceFqcn: ["com.example.Api"],
      }),
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.matchMethod, "INTERFACE");
    assert.equal(matches[0]?.basis, "extract");
    assert.equal(matches[0]?.confidence, 1);
    assert.deepEqual(matches[0]?.matchedValues, ["com.example.Api"]);
  });

  it("creates inferred DTO match with capped score below ENDPOINT", () => {
    const matches = matchRestClientControllerLinkCandidates(
      controller({
        id: "ctrl-1",
        applicationModuleId: "mod-server",
        dtoFqcn: ["com.example.FooDto", "com.example.BarDto"],
      }),
      client({
        id: "client-1",
        applicationModuleId: "mod-client",
        dtoFqcn: ["com.example.FooDto"],
      }),
    );

    const dtoMatch = matches.find((match) => match.matchMethod === "DTO");
    assert.ok(dtoMatch);
    assert.equal(dtoMatch.basis, "inference");
    assert.ok(dtoMatch.confidence > 0.25);
    assert.ok(dtoMatch.confidence <= 0.5);
    assert.ok(dtoMatch.confidence < 1);
  });

  it("creates inferred ENDPOINT match above DTO score for same overlap ratio", () => {
    const controllerRecord = controller({
      id: "ctrl-1",
      applicationModuleId: "mod-server",
      dtoFqcn: ["com.example.FooDto"],
      endpoints: ["GET /api/foo", "GET /actuator/health"],
    });
    const clientRecord = client({
      id: "client-1",
      applicationModuleId: "mod-client",
      dtoFqcn: ["com.example.FooDto"],
      endpoints: ["GET /api/foo"],
    });

    const matches = matchRestClientControllerLinkCandidates(controllerRecord, clientRecord);
    const dtoMatch = matches.find((match) => match.matchMethod === "DTO");
    const endpointMatch = matches.find((match) => match.matchMethod === "ENDPOINT");

    assert.ok(dtoMatch);
    assert.ok(endpointMatch);
    assert.ok(endpointMatch.confidence > dtoMatch.confidence);
    assert.ok(endpointMatch.confidence >= 0.55);
    assert.ok(endpointMatch.confidence <= 0.85);
  });

  it("ignores infrastructure endpoints when matching ENDPOINT strategy", () => {
    const matches = matchRestClientControllerLinkCandidates(
      controller({
        id: "ctrl-1",
        applicationModuleId: "mod-server",
        endpoints: ["GET /", "GET /actuator/health"],
      }),
      client({
        id: "client-1",
        applicationModuleId: "mod-client",
        endpoints: ["GET /", "GET /actuator/health"],
      }),
    );

    assert.equal(matches.find((match) => match.matchMethod === "ENDPOINT"), undefined);
  });

  it("collects independent matches for all controller x client pairs", () => {
    const links = collectRestClientToControllerLinks(
      [
        controller({
          id: "ctrl-1",
          applicationModuleId: "mod-server",
          implementedInterfaceFqcn: ["com.example.Api"],
        }),
      ],
      [
        client({
          id: "client-1",
          applicationModuleId: "mod-client",
          extendedInterfaceFqcn: ["com.example.Api"],
        }),
        client({
          id: "client-2",
          applicationModuleId: "mod-client-2",
          dtoFqcn: ["com.example.FooDto"],
        }),
      ],
    );

    assert.equal(links.length, 1);
    assert.equal(links[0]?.matchMethod, "INTERFACE");
  });
});
