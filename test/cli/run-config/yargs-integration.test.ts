import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import "../../../src/platform/processors/builtin-processors.js";
import { bootstrapArgv } from "../../../src/cli/run-config/bootstrap-argv.js";
import { globalOptions } from "../../../src/cli/global-options.js";
import { scanCommand } from "../../../src/cli/commands/scan.js";
import { validateGlobalArgv } from "../../../src/cli/validate-global-argv.js";
import { createTestTempDir } from "../../test-temp-dir.js";
import { resolveLocalRunConfigPath } from "../../../src/cli/run-config/resolve-run-config-path.js";

async function parseBootstrappedScanArgv(rawArgv: string[], cwd: string) {
  const previousCwd = process.cwd();
  process.chdir(cwd);
  try {
    const { argv: merged } = bootstrapArgv(rawArgv, cwd);
    const parsed = await yargs(hideBin(merged))
      .options(globalOptions)
      .command({
        ...scanCommand,
        handler: () => undefined,
      })
      .parse();

    validateGlobalArgv(parsed as Record<string, unknown>);
    return parsed;
  } finally {
    process.chdir(previousCwd);
  }
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

  it("ignores log-level from config", async () => {
    const cwd = createTestTempDir("c2a-yargs-log-level-");
    mkdirSync(path.join(cwd, "src"), { recursive: true });
    writeFileSync(
      resolveLocalRunConfigPath(cwd),
      "root:\n  log-level: DEBUG\nscan:\n  source-dir:\n    - ./src\n",
      "utf8",
    );

    const parsed = await parseBootstrappedScanArgv(
      ["node", "script", "scan", "./src"],
      cwd,
    );

    assert.equal(parsed.logLevel, "INFO");
  });
});
