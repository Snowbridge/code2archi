import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  enrichDiscoveryEntity,
  formatScannerExtractor,
} from "../../src/discovery-model/enrich-discovery-entity.js";
import { packageVersion } from "../../src/package-version.js";

describe("enrichDiscoveryEntity", () => {
  const previousTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Etc/GMT-3";
  });

  afterEach(() => {
    if (previousTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTz;
    }
  });

  it("adds platform metadata fields", () => {
    const extractedAt = new Date("2026-08-28T09:49:00.123Z");
    const enriched = enrichDiscoveryEntity(
      { id: "repo-1", name: "a" },
      { groupId: "scan-scope", artifactId: "git-repos" },
      extractedAt,
    );

    assert.equal(enriched.id, "repo-1");
    assert.equal(enriched.name, "a");
    assert.equal(enriched.scannerExtractor, "scan-scope:git-repos");
    assert.equal(enriched.scannerSchema, packageVersion);
    assert.equal(enriched.extractedAt, "2026-08-28T12:49:00.123+03:00");
  });

  it("formats scanner extractor as groupId:artifactId", () => {
    assert.equal(
      formatScannerExtractor({ groupId: "scan-tech", artifactId: "maven-module" }),
      "scan-tech:maven-module",
    );
  });
});
