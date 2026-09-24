export const LINK_TYPES = ["InferredHttpApiContractAssignment"] as const;

export type LinkType = (typeof LINK_TYPES)[number];
