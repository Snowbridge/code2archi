import type { LinkType } from "./links/link-types.js";

export const LINK_REF_INDEX_FIELDS: Partial<Record<LinkType, readonly string[]>> = {
  InferredHttpApiContractAssignment: ["contractId", "assigneeId"],
};
