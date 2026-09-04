export const LINK_TYPES = [
  "DirectRestRequestsServingMatch",
  "NodejsDirectRestRequestsServingMatch",
] as const;

export type LinkType = (typeof LINK_TYPES)[number];
