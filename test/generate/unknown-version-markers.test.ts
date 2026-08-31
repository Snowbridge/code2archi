import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectUnknownVersionMarkers,
  isUnknownVersionFieldApplicable,
} from "../../src/generate/unknown-version-markers.js";
import { systemSoftwareIdForEntry } from "../../src/generate/module-version-catalog.js";
import { UNKNOWN_VERSION } from "../../src/parsers/build-tool-versions.js";

function moduleSource(
  overrides: Partial<{
    id: string;
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
    id: "module-1",
    buildSystem: "maven" as const,
    buildToolVersion: UNKNOWN_VERSION,
    javaVersion: UNKNOWN_VERSION,
    kotlinJvmTarget: "17",
    kotlinCompilerVersion: "2.0.0",
    nodeVersion: "20",
    typescriptVersion: "5.0.0",
    tsxVersion: "4.0.0",
    ...overrides,
  };
}

describe("isUnknownVersionFieldApplicable", () => {
  it("applies java and kotlin only to maven and gradle", () => {
    assert.equal(isUnknownVersionFieldApplicable("javaVersion", "maven"), true);
    assert.equal(isUnknownVersionFieldApplicable("javaVersion", "npm"), false);
    assert.equal(isUnknownVersionFieldApplicable("kotlinJvmTarget", "gradle"), true);
    assert.equal(isUnknownVersionFieldApplicable("typescriptVersion", "npm"), true);
    assert.equal(isUnknownVersionFieldApplicable("typescriptVersion", "maven"), false);
  });

  it("applies buildToolVersion to all build systems", () => {
    assert.equal(isUnknownVersionFieldApplicable("buildToolVersion", "maven"), true);
    assert.equal(isUnknownVersionFieldApplicable("buildToolVersion", "gradle"), true);
    assert.equal(isUnknownVersionFieldApplicable("buildToolVersion", "npm"), true);
  });
});

describe("collectUnknownVersionMarkers", () => {
  it("deduplicates shared Maven unknown build and java catalog entries", () => {
    const markers = collectUnknownVersionMarkers([
      moduleSource({ id: "module-a" }),
      moduleSource({ id: "module-b" }),
    ]);

    assert.equal(markers.catalog.size, 2);
    assert.equal(
      markers.catalog.get(`buildToolVersion\u0000maven\u0000${UNKNOWN_VERSION}`)?.displayName,
      "Maven unknown",
    );
    assert.equal(
      markers.catalog.get(`javaVersion\u0000${UNKNOWN_VERSION}`)?.displayName,
      "Java unknown",
    );
    assert.equal(markers.assignments.length, 4);
  });

  it("skips non-applicable unknown fields for npm modules", () => {
    const markers = collectUnknownVersionMarkers([
      moduleSource({
        id: "npm-module",
        buildSystem: "npm",
        javaVersion: UNKNOWN_VERSION,
        nodeVersion: UNKNOWN_VERSION,
        buildToolVersion: UNKNOWN_VERSION,
        typescriptVersion: "5.0.0",
        tsxVersion: "4.0.0",
      }),
    ]);

    assert.equal(markers.catalog.has(`javaVersion\u0000${UNKNOWN_VERSION}`), false);
    assert.equal(
      markers.catalog.get(`nodeVersion\u0000${UNKNOWN_VERSION}`)?.displayName,
      "Node unknown",
    );
    assert.equal(
      markers.catalog.get(`buildToolVersion\u0000npm\u0000${UNKNOWN_VERSION}`)?.displayName,
      "npm unknown",
    );
    assert.equal(markers.assignments.length, 2);
    assert.equal(
      markers.assignments.every((assignment) => assignment.field !== "javaVersion"),
      true,
    );
  });

  it("omits fields with known versions", () => {
    const markers = collectUnknownVersionMarkers([
      moduleSource({
        buildToolVersion: "3.9.7",
        javaVersion: "17",
        kotlinJvmTarget: "17",
        kotlinCompilerVersion: "2.0.0",
      }),
    ]);

    assert.equal(markers.catalog.size, 0);
    assert.equal(markers.assignments.length, 0);
  });

  it("uses stable system software ids for unknown values", () => {
    const markers = collectUnknownVersionMarkers([moduleSource()]);

    const buildEntry = markers.catalog.get(`buildToolVersion\u0000maven\u0000${UNKNOWN_VERSION}`);
    assert.equal(
      buildEntry?.systemSoftwareId,
      systemSoftwareIdForEntry("buildToolVersion", UNKNOWN_VERSION, "maven"),
    );
  });
});
