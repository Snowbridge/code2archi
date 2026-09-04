import type { DirectRestRequestsServingMatchRecord } from "./direct-rest-requests-serving-match.js";
import type { NodejsDirectRestRequestsServingMatchRecord } from "./nodejs-direct-rest-requests-serving-match.js";
import type { LinkType } from "./link-types.js";
import { LINK_TYPES } from "./link-types.js";

export type DiscoveryLinkRecord =
  | DirectRestRequestsServingMatchRecord
  | NodejsDirectRestRequestsServingMatchRecord;

export type DiscoveryLinkRecordByType = {
  readonly DirectRestRequestsServingMatch: DirectRestRequestsServingMatchRecord;
  readonly NodejsDirectRestRequestsServingMatch: NodejsDirectRestRequestsServingMatchRecord;
};

export function isLinkType(value: string): value is LinkType {
  return (LINK_TYPES as readonly string[]).includes(value);
}
