import { createHash } from "node:crypto";
import { getLogger, isDebugEnabled } from "../../platform/logging/index.js";
import type { DiscoveryEntityCreateIntent } from "./entity-base.js";
import type { EntityType } from "./entity-types.js";

export abstract class Entity {
  readonly id: string;

  protected constructor(
    entityType: EntityType,
    naturalKeys: readonly unknown[],
  ) {
    this.id = Entity.computeId(entityType, naturalKeys);
  }

  private static computeId(
    entityType: EntityType,
    naturalKeys: readonly unknown[],
  ): string {
    const input = [entityType, ...naturalKeys].map(String).join(":");
    const hash = createHash("sha256").update(input).digest("hex");

    if (isDebugEnabled()) {
      getLogger("discovery.entityId").debug("entity id computed", {
        hash,
        input,
        naturalKeys: [entityType, ...naturalKeys],
      });
    }

    return hash;
  }

  abstract toCreateIntent(): DiscoveryEntityCreateIntent;
}
