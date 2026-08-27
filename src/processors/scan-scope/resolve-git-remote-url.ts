import { execFileSync } from "node:child_process";
import { parseGitRemoteUrlFromOutput } from "./parse-git-remote-url.js";

export function resolveGitRemoteUrl(localPath: string): string {
  try {
    const stdout = execFileSync("git", ["remote", "-v"], {
      cwd: localPath,
      encoding: "utf8",
    });
    return parseGitRemoteUrlFromOutput(stdout, "");
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
