import type { RestClientToControllerLinkRecord } from "./rest-client-to-controller-link.js";
import type { LinkType } from "./link-types.js";
import { LINK_TYPES } from "./link-types.js";

export type DiscoveryLinkRecord = RestClientToControllerLinkRecord;

export type DiscoveryLinkRecordByType = {
  readonly RestClientToControllerLink: RestClientToControllerLinkRecord;
};

export function isLinkType(value: string): value is LinkType {
  return (LINK_TYPES as readonly string[]).includes(value);
}
