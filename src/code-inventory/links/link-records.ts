import type { LinkType } from "./link-types.js";
import { LINK_TYPES } from "./link-types.js";

export interface DiscoveryLinkRecord {
  readonly id: string;
  readonly transformProcessor?: string;
  readonly transformSchema?: string;
  readonly linkedAt?: string;
}

export type DiscoveryLinkRecordByType = Partial<Record<LinkType, DiscoveryLinkRecord>>;

export function isLinkType(value: string): value is LinkType {
  return (LINK_TYPES as readonly string[]).includes(value);
}
