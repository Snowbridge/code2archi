import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import yargs from "yargs";
import "../../../src/platform/processors/builtin-processors.js";
import { bootstrapArgv } from "../../../src/cli/run-config/bootstrap-argv.js";
import { globalOptions } from "../../../src/cli/global-options.js";
import { generateCommand } from "../../../src/cli/commands/generate.js";
import { scanCommand } from "../../../src/cli/commands/scan.js";
import { validateGlobalArgv } from "../../../src/cli/validate-global-argv.js";
import { createTestTempDir } from "../../test-temp-dir.js";
import { resolveLocalRunConfigPath } from "../../../src/cli/run-config/resolve-run-config-path.js";

async function parseBootstrappedArgv(
  rawArgv: string[],
  cwd: string,
  commandModule: typeof scanCommand | typeof generateCommand,
) {
  const previousCwd = process.cwd();
  process.chdir(cwd);
  try {
    const { argv: merged } = bootstrapArgv(rawArgv, cwd);
    const parsed = await yargs(merged)
      .options(globalOptions)
      .command({
        ...commandModule,
        handler: () => undefined,
      })
      .parse();

    validateGlobalArgv(parsed as Record<string, unknown>);
    return parsed;
  } finally {
    process.chdir(previousCwd);
  }
}

async function parseBootstrappedScanArgv(rawArgv: string[], cwd: string) {
  return parseBootstrappedArgv(rawArgv, cwd, scanCommand);
}

async function parseBootstrappedGenerateArgv(rawArgv: string[], cwd: string) {
  return parseBootstrappedArgv(rawArgv, cwd, generateCommand);
}

describe("bootstrapArgv + yargs integration", () => {
  it("applies config profile and scan output when CLI does not override", async () => {
    const cwd = createTestTempDir("c2a-yargs-config-");
    const srcA = path.join(cwd, "src-a");
    const srcB = path.join(cwd, "src-b");
    writeFileSync(
      resolveLocalRunConfigPath(cwd),
      [
        "root:",
        "  profile: true",
        "scan:",
        "  source-dir:",
        "    - ./src-a",
        "  output: ./out",
      ].join("\n"),
      "utf8",
    );
    mkdirSync(srcA, { recursive: true });
    mkdirSync(srcB, { recursive: true });

    const parsed = await parseBootstrappedScanArgv(
      ["node", "script", "scan", "./src-b"],
      cwd,
    );

    assert.equal(parsed.profile, true);
    assert.equal(parsed.output, "./out");
    assert.deepEqual(parsed["source-dir"], ["./src-b"]);
  });

  it("ignores debug from config", async () => {
    const cwd = createTestTempDir("c2a-yargs-debug-");
    mkdirSync(path.join(cwd, "src"), { recursive: true });
    writeFileSync(
      resolveLocalRunConfigPath(cwd),
      "root:\n  debug: true\nscan:\n  source-dir:\n    - ./src\n",
      "utf8",
    );

    const parsed = await parseBootstrappedScanArgv(
      ["node", "script", "scan", "./src"],
      cwd,
    );

    assert.equal(parsed.debug, false);
  });

  it("parses --debug flag", async () => {
    const cwd = createTestTempDir("c2a-yargs-debug-flag-");
    mkdirSync(path.join(cwd, "src"), { recursive: true });

    const parsed = await parseBootstrappedScanArgv(
      ["node", "script", "--debug", "scan", "./src"],
      cwd,
    );

    assert.equal(parsed.debug, true);
  });

  it("applies source-dir from explicit --config when CLI omits positionals", async () => {
    const cwd = createTestTempDir("c2a-yargs-config-pos-");
    const configPath = path.join(cwd, "custom.yaml");
    mkdirSync(path.join(cwd, "src"), { recursive: true });
    writeFileSync(
      configPath,
      [
        "scan:",
        "  source-dir:",
        "    - ./src",
        "  output: ./out",
        "  force: true",
      ].join("\n"),
      "utf8",
    );

    const parsed = await parseBootstrappedScanArgv(["scan", "--config", configPath], cwd);

    assert.deepEqual(parsed["source-dir"], ["./src"]);
    assert.equal(parsed.output, "./out");
    assert.equal(parsed.force, true);
  });

  it("applies generate positionals from explicit --config when CLI omits them", async () => {
    const cwd = createTestTempDir("c2a-yargs-generate-config-pos-");
    const configPath = path.join(cwd, "custom.yaml");
    writeFileSync(
      configPath,
      [
        "generate:",
        "  output-file: model.archimate",
        "  code-inventory: ./scan-out/",
        "  force: true",
      ].join("\n"),
      "utf8",
    );

    const parsed = await parseBootstrappedGenerateArgv(
      ["generate", "--config", configPath],
      cwd,
    );

    assert.equal(parsed["output-file"], "model.archimate");
    assert.equal(parsed["code-inventory"], "./scan-out/");
    assert.equal(parsed.force, true);
  });
});
