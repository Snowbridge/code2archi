import { createHash } from "node:crypto";
import { getLogger, isDebugEnabled } from "../../platform/logging/index.js";
import type { DiscoveryLinkCreateIntent } from "./link-base.js";
import type { LinkType } from "./link-types.js";

export abstract class Link {
  readonly id: string;

  protected constructor(linkType: LinkType, naturalKeys: readonly unknown[]) {
    this.id = Link.computeId(linkType, naturalKeys);
  }

  private static computeId(linkType: LinkType, naturalKeys: readonly unknown[]): string {
    const input = [linkType, ...naturalKeys].map(String).join(":");
    const hash = createHash("sha256").update(input).digest("hex");

    if (isDebugEnabled()) {
      getLogger("discovery.linkId").debug("link id computed", {
        hash,
        input,
        naturalKeys: [linkType, ...naturalKeys],
      });
    }

    return hash;
  }

  abstract toCreateIntent(): DiscoveryLinkCreateIntent;
}
