import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

export class GitWorkingCopy {
  static findRepoRoots(sourceDir: string): string[] {
    const results: string[] = [];

    function walk(dir: string): void {
      if (GitWorkingCopy.hasGitDirectory(dir)) {
        results.push(path.resolve(dir));
        return;
      }

      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        throw new Error(`Failed to read directory: ${dir}`);
      }

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.isSymbolicLink()) {
          continue;
        }
        if (entry.name === ".git") {
          continue;
        }
        walk(path.join(dir, entry.name));
      }
    }

    walk(path.resolve(sourceDir));
    return results;
  }

  static findRepoRootsInSourceDirs(sourceDirs: readonly string[]): string[] {
    const repoRoots = new Set<string>();
    for (const sourceDir of sourceDirs) {
      for (const repoRoot of GitWorkingCopy.findRepoRoots(sourceDir)) {
        repoRoots.add(repoRoot);
      }
    }
    return [...repoRoots];
  }

  static parseRemoteUrlFromOutput(stdout: string, stderr: string): string {
    if (stderr.includes("fatal: not a git repository")) {
      return "";
    }

    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const originLine = lines.find((line) => /\borigin\b/.test(line));
    const selectedLine = originLine ?? lines[0];
    if (!selectedLine) {
      return "";
    }

    const match = selectedLine.match(/\S+\s+(\S+)\s+\(/);
    return match?.[1] ?? "";
  }

  static resolveRemoteUrl(localPath: string): string {
    try {
      const stdout = execFileSync("git", ["remote", "-v"], {
        cwd: localPath,
        encoding: "utf8",
      });
      return GitWorkingCopy.parseRemoteUrlFromOutput(stdout, "");
    } catch (error) {
      const execError = error as { stderr?: string | Buffer };
      const stderr = String(execError.stderr ?? "");

      if (stderr.includes("fatal: not a git repository")) {
        return "";
      }

      throw new Error(
        `Failed to resolve git remote for ${localPath}: ${stderr.trim() || String(error)}`,
      );
    }
  }

  private static hasGitDirectory(dir: string): boolean {
    const gitPath = path.join(dir, ".git");
    try {
      return statSync(gitPath).isDirectory();
    } catch {
      return false;
    }
  }
}
