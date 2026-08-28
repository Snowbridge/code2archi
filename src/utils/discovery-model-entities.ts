import { createHash } from "node:crypto";
import { getLogger, isDebugEnabled } from "../platform/logging/index.js";

export function createEntityId(naturalKeys: readonly unknown[]): string {
  const input = naturalKeys.map(String).join(":");
  const hash = createHash("sha256").update(input).digest("hex");

  if (isDebugEnabled()) {
    getLogger("discovery.entityId").debug("entity id computed", {
      hash,
      input,
      naturalKeys,
    });
  }

  return hash;
}
