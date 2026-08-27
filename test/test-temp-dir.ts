import { mkdirSync, mkdtempSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const applicationRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** Absolute path to `tmp/` at workspace root (sibling of `application/`). */
export const workspaceTmpDir = path.resolve(applicationRoot, "..", "tmp");

export function createTestTempDir(prefix: string): string {
  mkdirSync(workspaceTmpDir, { recursive: true });
  return mkdtempSync(path.join(workspaceTmpDir, prefix));
}
