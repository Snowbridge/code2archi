import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HttpClientApiRecord } from "../../../../../src/discovery-model/entities/http-client-api.js";
import type { HttpServerApiRecord } from "../../../../../src/discovery-model/entities/http-server-api.js";
import {
  collectHttpClientToServerApiLinks,
  matchHttpClientServerApiLinkCandidates,
} from "../../../../../src/processors/scan/transform/rest/http-client-server-api-link-match.js";

function server(
  overrides: Partial<HttpServerApiRecord> & Pick<HttpServerApiRecord, "id" | "applicationModuleId">,
): HttpServerApiRecord {
  return {
    name: "Controller",
    symbolKey: "com.example.Controller",
    payloadTypes: [],
    endpoints: [],
    concurrencyModel: "BLOCKING",
    bindingStyle: "ANNOTATION",
    contractTypes: [],
    sourceFile: "Controller.java",
    extractProcessor: "scan.extract:test",
    extractSchema: "0.0.0",
    extractedAt: "2026-01-01T00:00:00+00:00",
    ...overrides,
  };
}

function client(
  overrides: Partial<HttpClientApiRecord> & Pick<HttpClientApiRecord, "id" | "applicationModuleId">,
): HttpClientApiRecord {
  return {
    name: "Client",
    symbolKey: "com.example.Client",
    payloadTypes: [],
    endpoints: [],
    concurrencyModel: "BLOCKING",
    bindingStyle: "INTERFACE_MARKER",
    clientLibrary: "feign",
    inheritedContractTypes: [],
    sourceFile: "Client.java",
    extractProcessor: "scan.extract:test",
    extractSchema: "0.0.0",
    extractedAt: "2026-01-01T00:00:00+00:00",
    ...overrides,
  };
}

function qualified(name: string) {
  return { simpleName: name.split(".").pop() ?? name, qualifiedName: name };
}

describe("http-client-server-api-link-match", () => {
  it("skips matches within the same application module", () => {
    const matches = matchHttpClientServerApiLinkCandidates(
      server({
        id: "ctrl-1",
        applicationModuleId: "mod-a",
        contractTypes: [qualified("com.example.Api")],
      }),
      client({
        id: "client-1",
        applicationModuleId: "mod-a",
        inheritedContractTypes: [qualified("com.example.Api")],
      }),
    );

    assert.deepEqual(matches, []);
  });

  it("creates confirmed CONTRACT_TYPE match with score 1", () => {
    const matches = matchHttpClientServerApiLinkCandidates(
      server({
        id: "ctrl-1",
        applicationModuleId: "mod-server",
        contractTypes: [qualified("com.example.Api"), qualified("com.example.Other")],
      }),
      client({
        id: "client-1",
        applicationModuleId: "mod-client",
        inheritedContractTypes: [qualified("com.example.Api")],
      }),
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.matchMethod, "CONTRACT_TYPE");
    assert.equal(matches[0]?.basis, "extract");
    assert.equal(matches[0]?.confidence, 1);
    assert.deepEqual(matches[0]?.matchedValues, ["com.example.Api"]);
  });

  it("creates inferred PAYLOAD_TYPE match with capped score below ENDPOINT", () => {
    const matches = matchHttpClientServerApiLinkCandidates(
      server({
        id: "ctrl-1",
        applicationModuleId: "mod-server",
        payloadTypes: [qualified("com.example.FooDto"), qualified("com.example.BarDto")],
      }),
      client({
        id: "client-1",
        applicationModuleId: "mod-client",
        payloadTypes: [qualified("com.example.FooDto")],
      }),
    );

    const payloadMatch = matches.find((match) => match.matchMethod === "PAYLOAD_TYPE");
    assert.ok(payloadMatch);
    assert.equal(payloadMatch.basis, "inference");
    assert.ok(payloadMatch.confidence > 0.25);
    assert.ok(payloadMatch.confidence <= 0.5);
    assert.ok(payloadMatch.confidence < 1);
  });

  it("creates inferred ENDPOINT match above PAYLOAD_TYPE score for same overlap ratio", () => {
    const serverRecord = server({
      id: "ctrl-1",
      applicationModuleId: "mod-server",
      payloadTypes: [qualified("com.example.FooDto")],
      endpoints: ["GET /api/foo", "GET /actuator/health"],
    });
    const clientRecord = client({
      id: "client-1",
      applicationModuleId: "mod-client",
      payloadTypes: [qualified("com.example.FooDto")],
      endpoints: ["GET /api/foo"],
    });

    const matches = matchHttpClientServerApiLinkCandidates(serverRecord, clientRecord);
    const endpointMatch = matches.find((match) => match.matchMethod === "ENDPOINT");
    const payloadMatch = matches.find((match) => match.matchMethod === "PAYLOAD_TYPE");

    assert.ok(endpointMatch);
    assert.ok(payloadMatch);
    assert.ok(endpointMatch.confidence > payloadMatch.confidence);
  });

  it("collects and sorts links deterministically", () => {
    const links = collectHttpClientToServerApiLinks(
      [
        server({
          id: "ctrl-1",
          applicationModuleId: "mod-server",
          contractTypes: [qualified("com.example.Api")],
        }),
      ],
      [
        client({
          id: "client-1",
          applicationModuleId: "mod-client",
          inheritedContractTypes: [qualified("com.example.Api")],
        }),
        client({
          id: "client-2",
          applicationModuleId: "mod-client-2",
          payloadTypes: [qualified("com.example.FooDto")],
        }),
      ],
    );

    assert.equal(links.length, 1);
    assert.equal(links[0]?.httpServerApiId, "ctrl-1");
    assert.equal(links[0]?.httpClientApiId, "client-1");
  });
});
