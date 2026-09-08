export const LINK_TYPES = [] as const;

export type LinkType = (typeof LINK_TYPES)[number];
