import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectSystemSoftwareCatalog,
  confidenceForVersion,
  isEligibleApplicationModule,
  systemSoftwareDisplayName,
  systemSoftwareIdForEntry,
  systemSoftwareStableKey,
} from "../../src/generate/module-version-catalog.js";
import { UNKNOWN_VERSION } from "../../src/parsers/build-tool-versions.js";
import type { DiscoveryEntityRecord } from "../../src/discovery-model/entities/entity-types.js";

function eligibilityRecord(
  fields: Record<string, unknown>,
): DiscoveryEntityRecord {
  return fields as DiscoveryEntityRecord;
}

function moduleSource(
  overrides: Partial<{
    buildSystem: "maven" | "gradle" | "npm";
    buildToolVersion: string;
    javaVersion: string;
    kotlinJvmTarget: string;
    kotlinCompilerVersion: string;
    nodeVersion: string;
    typescriptVersion: string;
    tsxVersion: string;
  }> = {},
) {
  return {
    buildSystem: "maven" as const,
    buildToolVersion: UNKNOWN_VERSION,
    javaVersion: UNKNOWN_VERSION,
    kotlinJvmTarget: UNKNOWN_VERSION,
    kotlinCompilerVersion: UNKNOWN_VERSION,
    nodeVersion: UNKNOWN_VERSION,
    typescriptVersion: UNKNOWN_VERSION,
    tsxVersion: UNKNOWN_VERSION,
    ...overrides,
  };
}

describe("module-version-catalog", () => {
  it("excludes multimodule parent without parentId", () => {
    assert.equal(isEligibleApplicationModule(eligibilityRecord({ isMultimodule: true })), false);
    assert.equal(
      isEligibleApplicationModule(eligibilityRecord({ isMultimodule: true, parentId: "parent" })),
      true,
    );
    assert.equal(isEligibleApplicationModule(eligibilityRecord({ isMultimodule: false })), true);
  });

  it("maps confidence for unknown versions", () => {
    assert.equal(confidenceForVersion(UNKNOWN_VERSION), "unknown");
    assert.equal(confidenceForVersion("17"), "confirmed");
  });

  it("builds composite stable key for buildToolVersion", () => {
    const key = systemSoftwareStableKey("buildToolVersion", "3.9.7", "maven");
    assert.equal(key, "buildToolVersion\u0000maven\u00003.9.7");
    assert.notEqual(
      systemSoftwareStableKey("buildToolVersion", "3.9.7", "gradle"),
      systemSoftwareStableKey("buildToolVersion", "3.9.7", "maven"),
    );
  });

  it("normalizes npm build tool display name", () => {
    assert.equal(
      systemSoftwareDisplayName("buildToolVersion", "npm@10.0.0", "npm"),
      "npm 10.0.0",
    );
  });

  it("includes unknown in catalog and deduplicates shared values", () => {
    const catalog = collectSystemSoftwareCatalog([
      moduleSource({ javaVersion: UNKNOWN_VERSION }),
      moduleSource({ javaVersion: UNKNOWN_VERSION }),
      moduleSource({ javaVersion: "17" }),
    ]);

    assert.equal(catalog.size, 8);
    const unknownJavaKey = systemSoftwareStableKey("javaVersion", UNKNOWN_VERSION);
    const unknownJava = catalog.get(unknownJavaKey);
    assert.ok(unknownJava);
    assert.equal(unknownJava.displayName, "Java unknown");
    assert.equal(unknownJava.confidence, "unknown");
    assert.equal(
      unknownJava.systemSoftwareId,
      systemSoftwareIdForEntry("javaVersion", UNKNOWN_VERSION),
    );

    const java17Key = systemSoftwareStableKey("javaVersion", "17");
    assert.equal(catalog.get(java17Key)?.confidence, "confirmed");
  });
});
