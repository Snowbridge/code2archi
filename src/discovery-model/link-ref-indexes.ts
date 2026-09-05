import type { LinkType } from "./links/link-types.js";

/** Mirror of documentation/specifications/discovery-model/entity-types.md § ref-index fields (links) */
export const LINK_REF_INDEX_FIELDS: Partial<Record<LinkType, readonly string[]>> = {
  RestClientToControllerLink: [
    "sourceApplicationModuleId",
    "targetApplicationModuleId",
    "restControllerId",
    "restClientId",
  ],
  NodejsDirectRestRequestsServingMatch: [
    "sourceApplicationModuleId",
    "targetApplicationModuleId",
    "nodejsRestControllerId",
    "nodejsRestClientId",
  ],
};
