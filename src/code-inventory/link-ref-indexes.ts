import type { LinkType } from "./links/link-types.js";

/** Mirror of documentation/specifications/code-inventory/entity-types.md § ref-index fields (links) */
export const LINK_REF_INDEX_FIELDS: Partial<Record<LinkType, readonly string[]>> = {
  HttpClientToServerApiLink: [
    "sourceApplicationModuleId",
    "targetApplicationModuleId",
    "httpServerApiId",
    "httpClientApiId",
  ],
};
