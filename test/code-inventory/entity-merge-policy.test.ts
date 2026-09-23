import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DiscoveryEntityRecord } from "../../src/code-inventory/entities/entity-types.js";
import { mergeDuplicateEntity } from "../../src/code-inventory/entity-merge-policy.js";
import {
  RestClient,
  type RestClientOrigin,
} from "../../src/code-inventory/entities/rest-client.js";

function clientRecord(origin: RestClientOrigin): DiscoveryEntityRecord {
  const intent = new RestClient({
    applicationModuleId: "module-1",
    fqcn: "com.example.Client",
    simpleName: "Client",
    fileName: "src/main/java/com/example/Client.java",
    endpoints: [],
    contractIds: [],
    dataTypeIds: [],
    origin,
  }).toCreateIntent();
  return {
    ...intent,
    extractProcessor: "test",
    extractSchema: "0.0.0",
    extractedAt: "2026-09-23T00:00:00.000Z",
  } as DiscoveryEntityRecord;
}

describe("mergeDuplicateEntity (RestClient origin)", () => {
  it("keeps source origin when existing record is source-discovered", () => {
    const merged = mergeDuplicateEntity(
      "RestClient",
      clientRecord("source"),
      clientRecord("supplement"),
    );

    assert.equal(merged.origin, "source");
  });

  it("restores source origin when the supplemented record arrives first", () => {
    const merged = mergeDuplicateEntity(
      "RestClient",
      clientRecord("supplement"),
      clientRecord("source"),
    );

    assert.equal(merged.origin, "source");
  });

  it("keeps supplement origin when both records are supplemented", () => {
    const merged = mergeDuplicateEntity(
      "RestClient",
      clientRecord("supplement"),
      clientRecord("supplement"),
    );

    assert.equal(merged.origin, "supplement");
  });

  it("takes supplement origin when the existing legacy record has no origin field", () => {
    const legacy = { ...clientRecord("supplement") } as Record<string, unknown>;
    delete legacy.origin;

    const merged = mergeDuplicateEntity(
      "RestClient",
      legacy as DiscoveryEntityRecord,
      clientRecord("supplement"),
    );

    assert.equal(merged.origin, "supplement");
  });
});
