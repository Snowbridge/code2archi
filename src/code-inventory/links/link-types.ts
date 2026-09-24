export const LINK_TYPES = ["HttpApiContractAssignment"] as const;

export type LinkType = (typeof LINK_TYPES)[number];
