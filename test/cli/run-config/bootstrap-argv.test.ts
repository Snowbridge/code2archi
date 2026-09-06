import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { bootstrapArgv } from "../../../src/cli/run-config/bootstrap-argv.js";
import { mergeRunConfigSections, parseRunConfigDocument } from "../../../src/cli/run-config/merge-run-config.js";
import { normalizeProcessorFilterValue } from "../../../src/cli/run-config/normalize-processor-filter-value.js";
import {
  resolveGlobalRunConfigPath,
  resolveLocalRunConfigPath,
  resolveRunConfigPath,
} from "../../../src/cli/run-config/resolve-run-config-path.js";
import { resetRunConfigResolutionForTests } from "../../../src/cli/run-config/run-config-context.js";
import { createTestTempDir } from "../../test-temp-dir.js";
import { CliError } from "../../../src/cli/cli-error.js";

describe("resolveRunConfigPath", () => {
  it("prefers local code2archi.yaml over global", () => {
    const cwd = createTestTempDir("c2a-run-config-local-");
    const homedir = createTestTempDir("c2a-run-config-home-");
    writeFileSync(resolveLocalRunConfigPath(cwd), "root: {}\n", "utf8");
    mkdirSync(path.dirname(resolveGlobalRunConfigPath(homedir)), { recursive: true });
    writeFileSync(resolveGlobalRunConfigPath(homedir), "root: {}\n", "utf8");

    const resolved = resolveRunConfigPath({ cwd, configFlagValue: undefined, homedir });
    assert.equal(resolved, resolveLocalRunConfigPath(cwd));
  });

  it("uses global when local is absent", () => {
    const cwd = createTestTempDir("c2a-run-config-cwd-");
    mkdirSync(path.dirname(resolveGlobalRunConfigPath(cwd)), { recursive: true });
    writeFileSync(resolveGlobalRunConfigPath(cwd), "root: {}\n", "utf8");

    const resolved = resolveRunConfigPath({ cwd, configFlagValue: undefined, homedir: cwd });
    assert.equal(resolved, resolveGlobalRunConfigPath(cwd));
  });

  it("honors --config path and ignores local default file", () => {
    const cwd = createTestTempDir("c2a-run-config-explicit-");
    const explicit = path.join(cwd, "custom.yaml");
    writeFileSync(explicit, "root: {}\n", "utf8");
    writeFileSync(resolveLocalRunConfigPath(cwd), "root: {}\n", "utf8");

    const resolved = resolveRunConfigPath({ cwd, configFlagValue: explicit });
    assert.equal(resolved, path.resolve(explicit));
  });

  it("returns undefined for --config none", () => {
    const cwd = createTestTempDir("c2a-run-config-none-");
    writeFileSync(resolveLocalRunConfigPath(cwd), "root: {}\n", "utf8");
    assert.equal(
      resolveRunConfigPath({ cwd, configFlagValue: "none" }),
      undefined,
    );
  });

  it("throws when explicit config path is missing", () => {
    const cwd = createTestTempDir("c2a-run-config-missing-");
    assert.throws(
      () =>
        resolveRunConfigPath({
          cwd,
          configFlagValue: path.join(cwd, "missing.yaml"),
        }),
      (error: unknown) => error instanceof CliError,
    );
  });
});

describe("parseRunConfigDocument", () => {
  it("merges root and command with command override per key", () => {
    const { root, command } = parseRunConfigDocument(
      {
        root: { without: ["root-filter"], profile: true },
        scan: { without: ["scan-filter"], force: true },
      },
      "scan",
    );
    const effective = mergeRunConfigSections(root, command);
    assert.deepEqual(effective.without, ["scan-filter"]);
    assert.equal(effective.profile, true);
    assert.equal(effective.force, true);
  });

  it("silently ignores unknown keys", () => {
    const { root } = parseRunConfigDocument(
      { root: { foo: "bar", profile: true }, unknownNode: { x: 1 } },
      "scan",
    );
    assert.deepEqual(root, { profile: true });
  });

  it("normalizes with* none to empty arrays", () => {
    const { command } = parseRunConfigDocument(
      { scan: { without: "none", "with-only": ["none"] } },
      "scan",
    );
    assert.deepEqual(command.without, []);
    assert.deepEqual(command["with-only"], []);
  });
});

describe("normalizeProcessorFilterValue", () => {
  it("rejects none mixed with coordinates", () => {
    assert.throws(
      () => normalizeProcessorFilterValue(["foo", "none"], "--without"),
      (error: unknown) => error instanceof CliError,
    );
  });
});

describe("bootstrapArgv", () => {
  it("injects config options before CLI and lets CLI override arrays", () => {
    const cwd = createTestTempDir("c2a-bootstrap-override-");
    writeFileSync(
      resolveLocalRunConfigPath(cwd),
      [
        "root:",
        "  profile: true",
        "scan:",
        "  without:",
        "    - scan.extract.java.rest.controller-annotation-based",
      ].join("\n"),
      "utf8",
    );

    const fixture = path.join(cwd, "src");
    mkdirSync(fixture, { recursive: true });
    const { argv } = bootstrapArgv(
      ["node", "script", "scan", fixture, "--without", "scan.extract.*"],
      cwd,
    );

    assert.ok(argv.includes("--profile"));
    assert.ok(argv.includes("--without"));
    assert.equal(argv.at(-2), "--without");
    assert.equal(argv.at(-1), "scan.extract.*");
  });

  it("applies CLI --without none over config filters", () => {
    const cwd = createTestTempDir("c2a-bootstrap-without-none-");
    writeFileSync(
      resolveLocalRunConfigPath(cwd),
      "scan:\n  without:\n    - scan.extract.*\n",
      "utf8",
    );
    const fixture = path.join(cwd, "src");
    mkdirSync(fixture, { recursive: true });

    const { argv } = bootstrapArgv(
      ["node", "script", "scan", "--without", "none", fixture],
      cwd,
    );

    const withoutIndex = argv.lastIndexOf("--without");
    assert.equal(argv[withoutIndex + 1], "none");
  });

  it("skips config load for --help", () => {
    resetRunConfigResolutionForTests();
    const cwd = createTestTempDir("c2a-bootstrap-help-");
    writeFileSync(
      resolveLocalRunConfigPath(cwd),
      "root:\n  profile: true\n",
      "utf8",
    );

    const { argv, runConfig } = bootstrapArgv(["node", "script", "scan", "--help"], cwd);
    assert.deepEqual(argv, ["node", "script", "scan", "--help"]);
    assert.equal(runConfig.path, "none");
  });
});
