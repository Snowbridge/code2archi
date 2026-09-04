import type { DirectRestRequestsServingMatchRecord } from "./direct-rest-requests-serving-match.js";
import type { LinkType } from "./link-types.js";

export type DiscoveryLinkRecord = DirectRestRequestsServingMatchRecord;

export type DiscoveryLinkRecordByType = {
  readonly DirectRestRequestsServingMatch: DirectRestRequestsServingMatchRecord;
};

export function isLinkType(value: string): value is LinkType {
  return value === "DirectRestRequestsServingMatch";
}
