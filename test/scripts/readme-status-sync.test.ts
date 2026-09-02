import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { collectImplementationStatus } from "../../scripts/readme-status/collect.js";
import { SCAN_PROCESSOR_ENTITY_TYPES } from "../../scripts/readme-status/processor-scan-entities.js";
import { renderReadmeStatusSections } from "../../scripts/readme-status/render.js";

const APPLICATION_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("every registered scan processor has entity-type metadata or is generate-only", () => {
  const status = collectImplementationStatus();

  for (const processor of status.processors) {
    if (!processor.groupId.startsWith("scan.")) {
      continue;
    }
    assert.ok(
      SCAN_PROCESSOR_ENTITY_TYPES[processor.coordinate],
      `Missing SCAN_PROCESSOR_ENTITY_TYPES entry for ${processor.coordinate}`,
    );
  }
});

test("rendered README sections include all implemented commands", () => {
  const status = collectImplementationStatus();
  const sections = renderReadmeStatusSections(status);

  for (const command of status.implementedCommands) {
    assert.ok(
      sections.whatWorksToday.includes(`| \`${command}\` |`),
      `Expected command row for ${command}`,
    );
  }
});

test("README status sections are in sync with codebase", () => {
  execFileSync("npm", ["run", "readme:check"], {
    cwd: APPLICATION_ROOT,
    stdio: "pipe",
    shell: true,
  });
});

test("README contains sync markers", () => {
  const readme = readFileSync(path.join(APPLICATION_ROOT, "README.md"), "utf8");
  assert.match(readme, /<!-- readme-status:begin:what-works -->/);
  assert.match(readme, /<!-- readme-status:end:what-works -->/);
  assert.match(readme, /<!-- readme-status:begin:gap -->/);
  assert.match(readme, /<!-- readme-status:end:gap -->/);
});
