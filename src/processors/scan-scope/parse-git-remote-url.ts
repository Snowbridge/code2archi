export function parseGitRemoteUrlFromOutput(stdout: string, stderr: string): string {
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
