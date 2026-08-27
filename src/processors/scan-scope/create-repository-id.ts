import { createHash } from "node:crypto";

export function createRepositoryId(url: string, localPath: string): string {
  return createHash("sha256").update(`${url}:${localPath}`).digest("hex");
}
