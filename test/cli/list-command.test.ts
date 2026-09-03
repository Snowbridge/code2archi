import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const applicationRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const cliEntry = path.join(applicationRoot, "src/index.ts");

function runCli(args: string[], cwd: string): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync(
      process.execPath,
      ["--import", "tsx", cliEntry, ...args],
      {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return { stdout, stderr: "", status: 0 };
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      status?: number;
    };
    return {
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? "",
      status: execError.status ?? 1,
    };
  }
}

describe("list CLI command", () => {
  it("prints processor table by default", () => {
    const result = runCli(["list"], applicationRoot);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /artifactId\s+version\s+executionPolicy\s+description/);
    assert.match(result.stdout, /scan\.scope[\s\S]*git-repositories/);
  });

  it("filters processors by wildcard pattern", () => {
    const result = runCli(["list", "generate.elements.*"], applicationRoot);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /generate\.elements/);
    assert.doesNotMatch(result.stdout, /scan\.scope[\s\S]*git-repositories/);
  });

  it("prints only group ids with --only-groups", () => {
    const result = runCli(["list", "scan.scope", "--only-groups"], applicationRoot);
    assert.equal(result.status, 0);
    const lines = result.stdout.trimEnd().split("\n").map((line) => line.trimEnd());
    assert.deepEqual(lines, ["groupId", "scan.scope"]);
  });

  it("returns empty stdout for unknown group pattern", () => {
    const result = runCli(["list", "nonexistent.group"], applicationRoot);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
  });

  it("writes JSON file with --to-json", async () => {
    const jsonPath = path.join(applicationRoot, "code2archi-processors-list.json");
    try {
      const result = runCli(["list", "scan.scope", "--to-json"], applicationRoot);
      assert.equal(result.status, 0);
      assert.equal(result.stdout, "");

      const content = await readFile(jsonPath, "utf8");
      const payload = JSON.parse(content) as { processors: unknown[] };
      assert.ok(Array.isArray(payload.processors));
      assert.ok(payload.processors.length >= 2);
    } finally {
      await rm(jsonPath, { force: true });
    }
  });

  it("accepts command alias processors", () => {
    const result = runCli(["processors", "scan.scope", "--only-groups"], applicationRoot);
    assert.equal(result.status, 0);
    const lines = result.stdout.trimEnd().split("\n").map((line) => line.trimEnd());
    assert.deepEqual(lines, ["groupId", "scan.scope"]);
  });
});
