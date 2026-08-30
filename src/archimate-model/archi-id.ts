import { createHash } from "node:crypto";

export function computeArchiId(kind: string, ...stableKeys: readonly unknown[]): string {
  const input = [kind, ...stableKeys].map(String).join(":");
  return createHash("sha256").update(input).digest("hex");
}
