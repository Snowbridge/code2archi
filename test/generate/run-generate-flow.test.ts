import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { runGenerateFlow } from "../../src/generate/run-generate-flow.js";
import { validateGenerateArgs } from "../../src/generate/validate-generate-args.js";
import type { GlobalArgv } from "../../src/cli/processor-groups.js";
import { createTestTempDir } from "../test-temp-dir.js";

function emptyGlobalArgv(): GlobalArgv {
  return {
    logLevel: "INFO",
    verbose: false,
    profile: false,
    threads: 1,
    sync: false,
    continueOnError: false,
    with: [],
    without: [],
    withOnly: [],
  };
}

describe("runGenerateFlow", () => {
  it("writes bootstrap archimate model from discovery-model", () => {
    const tempDir = createTestTempDir("c2a-generate-flow-");
    const discoveryDir = path.join(tempDir, "discovery");
    mkdirSync(discoveryDir, { recursive: true });
    const outputFile = path.join(tempDir, "model.archimate");

    writeFileSync(
      path.join(discoveryDir, "manifest.json"),
      `${JSON.stringify(
        {
          formatVersion: "0.2.5",
          scanId: "scan-1",
          scannedAt: "2026-08-30T12:15:24.335+03:00",
          sourceRoot: tempDir,
          collections: [],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const generateArgs = validateGenerateArgs({
      outputFile,
      discoveryModelDir: discoveryDir,
      force: false,
    });

    runGenerateFlow({
      ...generateArgs,
      processorFilters: {
        with: [],
        without: [],
        withOnly: [],
      },
    });

    const xml = readFileSync(outputFile, "utf8");
    assert.match(xml, /<archimate:model/);
    assert.match(xml, /<folder name="Business"/);
    assert.match(xml, /<folder name="Views"/);
  });
});
