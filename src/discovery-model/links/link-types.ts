export const LINK_TYPES = [
  "RestClientToControllerLink",
  "NodejsDirectRestRequestsServingMatch",
] as const;

export type LinkType = (typeof LINK_TYPES)[number];
