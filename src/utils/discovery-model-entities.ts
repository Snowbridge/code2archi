import { createHash } from "node:crypto";

export function createEntityId(naturalKeys: readonly unknown[]): string {
  return createHash("sha256").update(naturalKeys.map(String).join(":")).digest("hex");
}
