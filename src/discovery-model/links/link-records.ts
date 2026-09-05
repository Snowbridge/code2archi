import type { HttpClientToServerApiLinkRecord } from "./http-client-to-server-api-link.js";
import type { LinkType } from "./link-types.js";
import { LINK_TYPES } from "./link-types.js";

export type DiscoveryLinkRecord = HttpClientToServerApiLinkRecord;

export type DiscoveryLinkRecordByType = {
  readonly HttpClientToServerApiLink: HttpClientToServerApiLinkRecord;
};

export function isLinkType(value: string): value is LinkType {
  return (LINK_TYPES as readonly string[]).includes(value);
}
