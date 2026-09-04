export const LINK_TYPES = ["DirectRestRequestsServingMatch"] as const;

export type LinkType = (typeof LINK_TYPES)[number];
