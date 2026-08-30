export const RELATION_TYPES = [
  "AccessRelationship",
  "AggregationRelationship",
  "AssignmentRelationship",
  "AssociationRelationship",
  "CompositionRelationship",
  "FlowRelationship",
  "RealizationRelationship",
  "ServingRelationship",
  "TriggeringRelationship",
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

const RELATION_TYPE_SET = new Set<string>(RELATION_TYPES);

export function isRelationType(value: string): value is RelationType {
  return RELATION_TYPE_SET.has(value);
}

export function archimateRelationXsiType(relationType: RelationType): string {
  return `archimate:${relationType}`;
}
