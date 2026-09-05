export const LINK_TYPES = ["RestClientToControllerLink"] as const;

export type LinkType = (typeof LINK_TYPES)[number];
