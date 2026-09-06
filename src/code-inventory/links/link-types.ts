export const LINK_TYPES = ["HttpClientToServerApiLink"] as const;

export type LinkType = (typeof LINK_TYPES)[number];
