import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Artifact } from "../../src/archimate-model/elements/archi-element.js";
import {
  entityDebugProperties,
  withEntityDebugProperties,
} from "../../src/generate/generate-debug.js";
import {
  initLogging,
  resetLoggingForTests,
} from "../../src/platform/logging/index.js";
import { createTestTempDir } from "../test-temp-dir.js";

describe("generate-debug", () => {
  it("returns no properties when log level is INFO", () => {
    initLogging({ logLevel: "INFO", verbose: false, logDirectory: createTestTempDir("c2a-debug-") });
    try {
      const properties = entityDebugProperties([
        {
          entityType: "Repository",
          record: {
            id: "repo-1",
            name: "demo",
            namespace: "/demo",
            localPath: "/demo",
            url: "",
            buildSystems: ["maven"],
            scannerExtractor: "scan.scope:git-repos",
            scannerSchema: "0.2.0",
            extractedAt: "2026-08-27T12:00:00.000Z",
          },
        },
      ]);
      assert.equal(properties.length, 0);
    } finally {
      resetLoggingForTests();
    }
  });

  it("emits c2a-debug properties for all entity fields when DEBUG", () => {
    initLogging({ logLevel: "DEBUG", verbose: false, logDirectory: createTestTempDir("c2a-debug-") });
    try {
      const properties = entityDebugProperties([
        {
          entityType: "Repository",
          record: {
            id: "repo-1",
            name: "demo",
            namespace: "/demo",
            localPath: "/demo",
            url: "https://example.com/demo.git",
            buildSystems: ["maven", "npm"],
            scannerExtractor: "scan.scope:git-repos",
            scannerSchema: "0.2.0",
            extractedAt: "2026-08-27T12:00:00.000Z",
          },
        },
      ]);

      assert.equal(properties.find((property) => property.key === "c2a-debug:Repository:name")?.value, "demo");
      assert.equal(
        properties.find((property) => property.key === "c2a-debug:Repository:buildSystems")?.value,
        '["maven","npm"]',
      );
    } finally {
      resetLoggingForTests();
    }
  });

  it("merges debug properties into element create-intent", () => {
    initLogging({ logLevel: "DEBUG", verbose: false, logDirectory: createTestTempDir("c2a-debug-") });
    try {
      const intent = withEntityDebugProperties(
        Artifact.withId("artifact-1")
          .name("demo")
          .inFolder("folder-1")
          .property("c2a:Id", "demo")
          .build()
          .toCreateIntent(),
        [
          {
            entityType: "Repository",
            record: {
              id: "repo-1",
              name: "demo",
              namespace: "/demo",
              localPath: "/demo",
              url: "",
              buildSystems: ["maven"],
              scannerExtractor: "scan.scope:git-repos",
              scannerSchema: "0.2.0",
              extractedAt: "2026-08-27T12:00:00.000Z",
            },
          },
        ],
      );

      assert.equal(intent.properties?.some((property) => property.key === "c2a:Id"), true);
      assert.equal(intent.properties?.some((property) => property.key === "c2a-debug:Repository:id"), true);
    } finally {
      resetLoggingForTests();
    }
  });
});
